import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1061EC",
          50: "#EAF1FE",
          100: "#D5E3FD",
          200: "#ABC7FB",
          300: "#82AAF9",
          400: "#588EF6",
          500: "#1061EC",
          600: "#0D4EBD",
          700: "#0A3B8E",
          800: "#06275F",
          900: "#031430",
        },
        navy: {
          DEFAULT: "#03102B",
          50: "#EBEDF2",
          100: "#CBD1E0",
          200: "#98A3C1",
          300: "#6575A2",
          400: "#3A4A7C",
          500: "#1C2A54",
          600: "#141F40",
          700: "#0D152C",
          800: "#070C1A",
          900: "#03102B",
        },
        // Per-Workspace accent, set at runtime from `brand.primaryColor` in
        // the published Workspace JSON — see src/lib/workspaceTheme.ts.
        // Distinct from `primary` (BGrowth's own brand color) since every
        // product can theme itself independently.
        workspace: {
          DEFAULT: "rgb(var(--color-workspace-500) / <alpha-value>)",
          50: "rgb(var(--color-workspace-50) / <alpha-value>)",
          100: "rgb(var(--color-workspace-100) / <alpha-value>)",
          200: "rgb(var(--color-workspace-200) / <alpha-value>)",
          300: "rgb(var(--color-workspace-300) / <alpha-value>)",
          400: "rgb(var(--color-workspace-400) / <alpha-value>)",
          500: "rgb(var(--color-workspace-500) / <alpha-value>)",
          600: "rgb(var(--color-workspace-600) / <alpha-value>)",
          700: "rgb(var(--color-workspace-700) / <alpha-value>)",
          800: "rgb(var(--color-workspace-800) / <alpha-value>)",
          900: "rgb(var(--color-workspace-900) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Poppins",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        soft: "0 2px 8px 0 rgb(3 16 43 / 0.06), 0 1px 2px 0 rgb(3 16 43 / 0.04)",
        "soft-lg":
          "0 12px 32px -4px rgb(3 16 43 / 0.12), 0 4px 8px -2px rgb(3 16 43 / 0.06)",
        "soft-dark":
          "0 2px 8px 0 rgb(0 0 0 / 0.24), 0 1px 2px 0 rgb(0 0 0 / 0.16)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
