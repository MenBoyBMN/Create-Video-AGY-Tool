/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/index.html',
    './app/src/**/*.{ts,tsx}',
    './engine/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          canvas: '#0a0a0b',
          base: '#111113',
          panel: '#161618',
          elevated: '#1c1c1f',
          hover: '#232327',
          border: '#26262a',
          borderStrong: '#323238',
          accent: '#2563eb',
          accentHover: '#3b82f6',
          playhead: '#ef4444',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
