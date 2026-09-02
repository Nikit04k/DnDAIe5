import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "Cinzel", "Georgia", "serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        fantasy: {
          dark: "#090a0f",
          darker: "#06070a",
          card: "#10131d",
          border: "#1e2436",
          gold: "#d97706",
          goldLight: "#fbbf24",
          goldDark: "#92400e",
          ruby: "#dc2626",
          arcane: "#8b5cf6",
          emerald: "#10b981",
        },
      },
      animation: {
        'dice-spin': 'diceRoll 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        diceRoll: {
          '0%': { transform: 'rotate(0deg) scale(0.6)', opacity: '0.5' },
          '50%': { transform: 'rotate(180deg) scale(1.15)', opacity: '0.8' },
          '100%': { transform: 'rotate(360deg) scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { opacity: '0.85', filter: 'brightness(1)' },
          '100%': { opacity: '1', filter: 'brightness(1.15)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
