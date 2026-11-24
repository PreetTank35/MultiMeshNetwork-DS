/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: { deep: '#0B1120', bg: '#0F172A', grid: '#1E293B' },
        panel: { bg: '#1E293B', border: '#334155', glass: 'rgba(30,41,59,0.7)' },
        mesh: { wifi: '#3B82F6', iot: '#10B981', gateway: '#F59E0B', failure: '#EF4444', accent: '#8B5CF6' },
      },
      fontFamily: { mono: ['JetBrains Mono','Fira Code','Consolas','monospace'] },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-out-right': 'slideOutRight 0.2s ease-in',
        'fade-up': 'fadeUp 0.3s ease-out',
      },
      keyframes: {
        slideInRight: { '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideOutRight: { '0%': { transform: 'translateX(0)', opacity: '1' }, '100%': { transform: 'translateX(100%)', opacity: '0' } },
        fadeUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
