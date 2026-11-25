/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: {
          deep: 'var(--neu-canvas)',
          bg: 'var(--neu-bg)',
          grid: 'var(--neu-grid)',
        },
        neu: {
          base: 'var(--neu-bg)',
          surface: 'var(--neu-surface)',
          elevated: 'var(--neu-surface-hi)',
          sunken: 'var(--neu-sunken)',
          text: 'var(--neu-text)',
          muted: 'var(--neu-text-muted)',
          subtle: 'var(--neu-text-subtle)',
          border: 'var(--neu-border)',
          'border-highlight': 'var(--neu-border-hi)',
        },
        panel: {
          bg: 'var(--neu-surface)',
          border: 'var(--neu-border)',
        },
        mesh: {
          wifi: '#2563EB',
          iot: '#059669',
          gateway: '#D97706',
          route: '#0891B2',
          failure: '#DC2626',
          accent: '#7C3AED',
        },
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'] },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-out-right': 'slideOutRight 0.2s ease-in',
        'fade-up': 'fadeUp 0.22s ease-out',
        'beacon': 'beacon 2s infinite',
      },
      keyframes: {
        slideInRight: { '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideOutRight: { '0%': { transform: 'translateX(0)', opacity: '1' }, '100%': { transform: 'translateX(100%)', opacity: '0' } },
        fadeUp: { '0%': { transform: 'translateY(6px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        beacon: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.45', transform: 'scale(1.15)' } },
      },
    },
  },
  plugins: [],
};
