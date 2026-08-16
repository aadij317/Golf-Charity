import type { Config } from "tailwindcss";

// Design direction: "scorecard console" — an internal instrument, not the
// marketing site. Golf's real artifact is the paper scorecard: ruled rows,
// small mono numerals, a single stamped accent for "this needs you" states.
// Ink-navy surface (not the generic near-black), a bone/paper card surface,
// and one signal color (fairway green) reserved for money/approval states,
// one warning (flag red) reserved for pending/attention states.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12181B", // primary surface — deep ink-navy, not pure black
          soft: "#1B2327",
          line: "#2A3439",
        },
        paper: {
          DEFAULT: "#F6F3EC", // scorecard paper
          dim: "#E8E3D6",
        },
        fairway: {
          DEFAULT: "#1F6F4A", // approvals / paid / active
          soft: "#2E8A5E",
        },
        flag: {
          DEFAULT: "#B5432E", // pending / attention / rejected
          soft: "#D4573E",
        },
        sand: {
          DEFAULT: "#C9A46A", // rollover / jackpot accent, used sparingly
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "3px",
      },
    },
  },
  plugins: [],
};
export default config;
