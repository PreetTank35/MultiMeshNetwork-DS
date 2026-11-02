/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#0F172A',
          grid: '#1E293B',
        },
        panel: {
          bg: '#1E293B',
          border: '#334155',
          header: '#0F172A',
        },
        mesh: {
          wifi: '#3B82F6',
          iot: '#10B981',
          gateway: '#F59E0B',
          failure: '#EF4444',
          accent: '#8B5CF6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
