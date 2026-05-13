import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2937",
        line: "#e5e7eb",
        paper: "#fffdf8",
        brand: "#ffd100",
        leaf: "#16a34a",
        coral: "#ef6f61"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(31, 41, 55, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
