import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'barber-blue': '#0047AB',
        'sharp-red': '#DC2626',
        'dark-gray': '#1a1a1a',
      },
      boxShadow: {
        'red-glow': '0 0 15px rgba(220, 38, 38, 0.5)',
      },
    },
  },
  plugins: [],
};
export default config;
