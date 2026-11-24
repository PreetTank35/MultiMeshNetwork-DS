/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: { deep: '#121620', bg: '#161B26', grid: '#1E2536' },
        neu: {
          base: '#161B26',
          surface: '#1B202E',
          elevated: '#202637',
          sunken: '#131722',
          border: 'rgba(255, 255, 255, 0.05)',
          'border-highlight': 'rgba(255, 255, 255, 0.1)',
        },
        panel: { bg: '#1B202E', border: '#252D3F', glass: 'rgba(27, 32, 46, 0.85)' },
        mesh: {
          wifi: '#2563EB',     // Electric Cobalt
          iot: '#059669',      // Cyber Green
          gateway: '#D97706',  // Amber Gold
          route: '#06B6D4',    // Cyan Active Routes
          failure: '#DC2626',  // Coral Red Faults/Drops
          accent: '#8B5CF6',
        },
      },
      boxShadow: {
        'neu-flat': '6px 6px 14px #0f131b, -6px -6px 14px #1f2737',
        'neu-flat-sm': '3px 3px 8px #0f131b, -3px -3px 8px #1f2737',
        'neu-convex': '6px 6px 14px #0f131b, -6px -6px 14px #222b3d',
        'neu-convex-sm': '3px 3px 8px #0f131b, -3px -3px 8px #222b3d',
        'neu-pressed': 'inset 4px 4px 8px #0d1017, inset -4px -4px 8px #1d2433',
        'neu-pressed-sm': 'inset 2px 2px 5px #0d1017, inset -2px -2px 5px #1d2433',
        'neu-button': '4px 4px 10px #0f131b, -4px -4px 10px #21293a',
        'neu-button-sm': '2px 2px 6px #0f131b, -2px -2px 6px #21293a',
        'neu-button-active': 'inset 3px 3px 6px #0d1017, inset -3px -3px 6px #1f2737',
        'neu-glow-wifi': '0 0 15px rgba(37, 99, 235, 0.4), 4px 4px 10px #0f131b, -4px -4px 10px #1f2737',
        'neu-glow-iot': '0 0 15px rgba(5, 150, 105, 0.4), 4px 4px 10px #0f131b, -4px -4px 10px #1f2737',
        'neu-glow-gateway': '0 0 15px rgba(217, 119, 6, 0.4), 4px 4px 10px #0f131b, -4px -4px 10px #1f2737',
        'neu-glow-route': '0 0 15px rgba(6, 182, 212, 0.4), 4px 4px 10px #0f131b, -4px -4px 10px #1f2737',
        'neu-glow-failure': '0 0 15px rgba(220, 38, 38, 0.4), 4px 4px 10px #0f131b, -4px -4px 10px #1f2737',
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'] },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-out-right': 'slideOutRight 0.2s ease-in',
        'fade-up': 'fadeUp 0.25s ease-out',
        'beacon': 'beacon 2s infinite',
      },
      keyframes: {
        slideInRight: { '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideOutRight: { '0%': { transform: 'translateX(0)', opacity: '1' }, '100%': { transform: 'translateX(100%)', opacity: '0' } },
        fadeUp: { '0%': { transform: 'translateY(6px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        beacon: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(1.15)' } },
      },
    },
  },
  plugins: [],
}
