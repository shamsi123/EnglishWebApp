/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        arabic: ['"Baloo Bhaijaan 2"', '"Noto Naskh Arabic"', 'serif'],
        naskh: ['"Noto Naskh Arabic"', 'serif'],
      },
      colors: {
        cream: '#fef9f0',
        ink: '#2d2a4a',
        grape: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
        sun: { 100: '#fef3c7', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b' },
        leaf: { 100: '#dcfce7', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
        sky2: { 100: '#e0f2fe', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9' },
        coral: { 100: '#ffe4e6', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e' },
      },
      minHeight: { tap: '56px' },
      minWidth: { tap: '56px' },
      borderRadius: { blob: '1.75rem' },
    },
  },
  plugins: [],
};
