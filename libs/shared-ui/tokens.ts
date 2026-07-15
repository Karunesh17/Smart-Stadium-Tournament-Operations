// design tokens matching docs/design.md
export const colors = {
  bg: {
    primary: "#0B0E14",    // App background (dark theme default)
    surface: "#151922",    // Card/panel surfaces
    elevated: "#1E2430",   // Modals, dropdowns
  },
  border: {
    subtle: "#2A3140",     // Card borders, dividers
  },
  text: {
    primary: "#F2F4F8",    // Primary text
    secondary: "#8B93A7",  // Secondary/meta text
  },
  accent: {
    primary: "#4C8DFF",    // Primary actions, links, active nav
  },
  status: {
    ok: "#2ECC71",         // Normal stock, low crowd density, done tasks
    warning: "#F5A623",    // Low stock, moderate density, in-progress tasks
    critical: "#E5484D",   // Stockout, high density, high/critical incidents
  },
  ai: {
    accent: "#9B6DFF",     // AI Copilot surfaces
  }
};

export const typography = {
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
  fontFamilyMono: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  sizes: {
    caption: "12px",
    "body-sm": "14px",
    body: "16px",
    h3: "20px",
    h2: "24px",
    h1: "32px",
  },
  weights: {
    normal: "400",
    semibold: "600",
    bold: "700",
  }
};

export const spacing = {
  base: "4px",
  scale: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
    "4xl": "64px",
  }
};

export const borderRadius = {
  sm: "8px",     // buttons primary actions
  md: "12px",    // cards
};

export const animations = {
  duration: {
    fast: "150ms", // hover/focus states
    normal: "200ms", // panel open/close
  },
  timing: {
    easeOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  }
};
