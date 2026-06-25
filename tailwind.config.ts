import type { Config } from "tailwindcss";

// Design tokens mirror the GrowthArchon dashboard so the board reads like the
// weekly L10. Named colors (text/surface/accent/border) back the utility
// classes used throughout the components (e.g. `text-text-muted`, `bg-surface`).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#e2e8f0",
        surface: {
          DEFAULT: "#ffffff",
          alt: "#f8fafc"
        },
        text: {
          DEFAULT: "#0f172a",
          muted: "#64748b",
          inverse: "#ffffff"
        },
        accent: {
          DEFAULT: "#4f46e5",
          strong: "#4338ca"
        }
      },
      fontFamily: {
        display: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
