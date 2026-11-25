// Offline Zero-Network TypeScript Test Runner
// Bundles tests/*.test.ts (recursively) to temporary .mjs files via local esbuild and runs node --test.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectMjsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMjsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch (err) {
    // Fallback for git worktrees where node_modules lives in the main repo checkout
    const localCandidate = path.join(repoRoot, 'node_modules', 'esbuild', 'lib', 'main.js');
    if (fs.existsSync(localCandidate)) {
      return await import(pathToFileURL(localCandidate).href);
    }
    try {
      const commonGitDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim();
      const resolvedGitDir = path.isAbsolute(commonGitDir)
        ? commonGitDir
        : path.resolve(repoRoot, commonGitDir);
      const mainRepoRoot = path.dirname(resolvedGitDir);
      const worktreeFallback = path.join(mainRepoRoot, 'node_modules', 'esbuild', 'lib', 'main.js');
      if (fs.existsSync(worktreeFallback)) {
        return await import(pathToFileURL(worktreeFallback).href);
      }
    } catch {
      // Fall through to rethrow original error
    }
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filters = [];
  const nodeTestFlags = [];

  for (const arg of args) {
    if (arg.startsWith('-')) {
      nodeTestFlags.push(arg);
    } else {
      filters.push(arg.replace(/\\/g, '/').toLowerCase());
    }
  }

  const allTests = collectTestFiles(testsDir);
  if (allTests.length === 0) {
    console.log('[test-runner] No *.test.ts files found under tests/. Skipping cleanly.');
    process.exit(0);
  }

  const matchedTests =
    filters.length === 0
      ? allTests
      : allTests.filter((filePath) => {
          const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/').toLowerCase();
          return filters.some((f) => rel.includes(f));
        });

  if (matchedTests.length === 0) {
    console.error(`[test-runner] No test files matched filter(s): ${filters.join(', ')}`);
    process.exit(1);
  }

  const esbuild = await loadEsbuild();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multimesh-tests-'));

  try {
    await esbuild.build({
      entryPoints: matchedTests,
      outdir: tempDir,
      outbase: testsDir,
      outExtension: { '.js': '.mjs' },
      bundle: true,
      splitting: false,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      sourcemap: 'inline',
      external: ['node:*'],
      logLevel: 'silent',
    });

    const bundledTests = collectMjsFiles(tempDir);
    if (bundledTests.length === 0) {
      console.error('[test-runner] Esbuild produced no test bundles.');
      process.exit(1);
    }

    const result = spawnSync(
      process.execPath,
      ['--enable-source-maps', '--test', ...nodeTestFlags, ...bundledTests],
      {
        cwd: repoRoot,
        stdio: 'inherit',
      }
    );

    process.exit(result.status ?? 1);
  } catch (err) {
    console.error('[test-runner] Failed to build or run tests:', err);
    process.exit(1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
