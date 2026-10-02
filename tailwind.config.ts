import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FFFDF8",
          100: "#FDF8EF",
          200: "#F7EDDC",
          300: "#F0E1C8",
        },
        cocoa: {
          50: "#FBF6F3",
          100: "#F3E5DE",
          200: "#E5C9BB",
          300: "#D2A78F",
          400: "#B98066",
          500: "#9C6248",
          600: "#7E4A33",
          700: "#5F3826",
          800: "#452A1D",
          900: "#2E1B13",
        },
        blush: {
          50: "#FDF4F6",
          100: "#FAE8ED",
          200: "#F5CFDA",
          300: "#ECABC0",
          400: "#DE7F9E",
          500: "#C95A82",
          600: "#A93E65",
          700: "#872F4F",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 2px 12px rgba(69, 42, 29, 0.08)",
        "card-hover": "0 8px 24px rgba(69, 42, 29, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
