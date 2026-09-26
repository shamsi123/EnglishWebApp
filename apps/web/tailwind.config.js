/** Design tokens shared by the web and Capacitor builds (BRD §9). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
        danger: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
      },
      spacing: { touch: "44px" },
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
      maxWidth: { player: "480px" },
    },
  },
  plugins: [],
};
