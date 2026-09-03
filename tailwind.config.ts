import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#26362F", soft: "#59645D", line: "#E6E1D7" },
        paper: { DEFAULT: "#FBF9F4", dim: "#F3EEE4" },
        fairway: { DEFAULT: "#174A39", soft: "#2C6A55" },
        flag: { DEFAULT: "#A85C48", soft: "#B96B56" },
        sand: { DEFAULT: "#B9903F" },
        sage: "#8AA08D",
        line: "#E6E1D7",
        cream: "#FBF9F4",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: { card: "14px" },
      boxShadow: { soft: "0 10px 35px rgba(38,54,47,.06)" },
    },
  },
  plugins: [],
};
export default config;
