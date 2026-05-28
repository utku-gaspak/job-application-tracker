/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        // Everforest mappings (names kept for backward compatibility)
        "primary-gold": "var(--color-primary)",
        "primary-gold-muted": "var(--color-primary-muted)",
        "primary-soft": "var(--color-primary-soft)",
        "deco-bg": "var(--color-background)",
        "deco-surface": "var(--color-surface)",
        "deco-surface-soft": "var(--color-surface-soft)",
        "deco-card": "var(--color-card)",
        "deco-input": "var(--color-input)",
        "deco-foreground": "var(--color-foreground)",
        "deco-muted": "var(--color-muted-foreground)",
        "border-gold": "var(--deco-border-gold)",
        "border-gold-muted": "var(--color-border)",

        accent: "var(--color-accent)",
        danger: "var(--color-danger)",
        "danger-soft": "var(--color-danger-soft)",

        "column-applied": "var(--color-column-applied)",
        "column-interviewing": "var(--color-column-interviewing)",
        "column-rejected": "var(--color-column-rejected)",
        "column-offer": "var(--color-column-offer)",
      },
      boxShadow: {
        "deco-panel": "var(--deco-shadow-panel)",
        "deco-card": "var(--shadow-card)",
        "deco-glow": "var(--deco-shadow-glow)",
      },
      letterSpacing: {
        // Minimalist dashboard requires tight yet readable spacing
        "deco-tight": "-0.01em",
        "deco-wide": "0.1em",
        "deco-wider": "0.2em",
      },
    },
  },
  plugins: [],
};
