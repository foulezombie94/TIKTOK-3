import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        tiktok: {
          pink: "#FE2C55",
          cyan: "#25F4EE",
          dark: "#121212",
          card: "#1a1a1a",
          gray: "#8a8b91",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "spin-slow": "spin 5s linear infinite",
        "bounce-in": "bounceIn 0.4s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "music-note": "musicNote 2s ease-in-out infinite",
      },
      keyframes: {
        bounceIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.2)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        musicNote: {
          "0%": { transform: "translateX(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateX(20px) rotate(45deg)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
