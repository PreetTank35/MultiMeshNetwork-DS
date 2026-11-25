declare module 'node:test' {
  export interface TestContext {
    name: string;
    test: TestFn;
    diagnostic(message: string): void;
    plan(count: number): void;
    skip(message?: string): void;
    todo(message?: string): void;
  }

  export interface SuiteContext {
    name: string;
  }

  export interface TestOptions {
    concurrency?: number | boolean;
    only?: boolean;
    skip?: boolean | string;
    todo?: boolean | string;
    timeout?: number;
  }

  export type TestCallback = (t: TestContext) => void | Promise<void>;
  export type SuiteCallback = (s: SuiteContext) => void | Promise<void>;
  export type HookCallback = (t: TestContext) => void | Promise<void>;

  export interface TestFn {
    (name?: string, fn?: TestCallback): Promise<void>;
    (name: string, options: TestOptions, fn?: TestCallback): Promise<void>;
    (options: TestOptions, fn?: TestCallback): Promise<void>;
    (fn: TestCallback): Promise<void>;
    skip(name?: string, fn?: TestCallback): Promise<void>;
    skip(name: string, options: TestOptions, fn?: TestCallback): Promise<void>;
    only(name?: string, fn?: TestCallback): Promise<void>;
    only(name: string, options: TestOptions, fn?: TestCallback): Promise<void>;
    todo(name?: string, fn?: TestCallback): Promise<void>;
    todo(name: string, options: TestOptions, fn?: TestCallback): Promise<void>;
  }

  export interface DescribeFn {
    (name?: string, fn?: SuiteCallback): Promise<void>;
    (name: string, options: TestOptions, fn?: SuiteCallback): Promise<void>;
    skip(name?: string, fn?: SuiteCallback): Promise<void>;
    only(name?: string, fn?: SuiteCallback): Promise<void>;
    todo(name?: string, fn?: SuiteCallback): Promise<void>;
  }

  export const test: TestFn;
  export const it: TestFn;
  export const describe: DescribeFn;
  export const suite: DescribeFn;
  export function before(fn?: HookCallback, options?: TestOptions): void;
  export function after(fn?: HookCallback, options?: TestOptions): void;
  export function beforeEach(fn?: HookCallback, options?: TestOptions): void;
  export function afterEach(fn?: HookCallback, options?: TestOptions): void;
  export default test;
}

declare module 'node:assert/strict' {
  export class AssertionError extends Error {
    actual: unknown;
    expected: unknown;
    operator: string;
    generatedMessage: boolean;
    code: string;
  }

  export interface AssertStrict {
    (value: unknown, message?: string | Error): asserts value;
    ok(value: unknown, message?: string | Error): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    strictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    notStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    notDeepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    deepStrictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    notDeepStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    throws(fn: () => unknown, error?: RegExp | Function | Error | Record<string, unknown>, message?: string | Error): void;
    doesNotThrow(fn: () => unknown, message?: string | Error): void;
    rejects(fn: (() => Promise<unknown>) | Promise<unknown>, error?: RegExp | Function | Error | Record<string, unknown>, message?: string | Error): Promise<void>;
    doesNotReject(fn: (() => Promise<unknown>) | Promise<unknown>, message?: string | Error): Promise<void>;
    match(value: string, regExp: RegExp, message?: string | Error): void;
    doesNotMatch(value: string, regExp: RegExp, message?: string | Error): void;
    ifError(value: unknown): asserts value is null | undefined;
    fail(message?: string | Error): never;
    AssertionError: typeof AssertionError;
  }

  const assert: AssertStrict;
  export const ok: AssertStrict['ok'];
  export const equal: AssertStrict['equal'];
  export const notEqual: AssertStrict['notEqual'];
  export const strictEqual: AssertStrict['strictEqual'];
  export const notStrictEqual: AssertStrict['notStrictEqual'];
  export const deepEqual: AssertStrict['deepEqual'];
  export const notDeepEqual: AssertStrict['notDeepEqual'];
  export const deepStrictEqual: AssertStrict['deepStrictEqual'];
  export const notDeepStrictEqual: AssertStrict['notDeepStrictEqual'];
  export const throws: AssertStrict['throws'];
  export const doesNotThrow: AssertStrict['doesNotThrow'];
  export const rejects: AssertStrict['rejects'];
  export const doesNotReject: AssertStrict['doesNotReject'];
  export const match: AssertStrict['match'];
  export const doesNotMatch: AssertStrict['doesNotMatch'];
  export const ifError: AssertStrict['ifError'];
  export const fail: AssertStrict['fail'];
  export default assert;
}

declare module 'node:assert' {
  export * from 'node:assert/strict';
  import assert from 'node:assert/strict';
  export default assert;
}
