import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        fontan: {
          blue: "#1d4ed8",
          green: "#047857",
          ink: "#172033"
        }
      }
    }
  },
  plugins: []
};

export default config;
