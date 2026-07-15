/** @type {import('tailwindcss').Config} */
module.exports = {{
  content: [
    "./src/pages/**/*.{{js,ts,jsx,tsx,mdx}}",
    "./src/components/**/*.{{js,ts,jsx,tsx,mdx}}",
    "./src/app/**/*.{{js,ts,jsx,tsx,mdx}}",
  ],
  theme: {{
    extend: {{
      colors: {{
        bg: {{
          primary: "#0B0E14",
          surface: "#151922",
          elevated: "#1E2430",
        }},
        border: {{
          subtle: "#2A3140",
        }},
        text: {{
          primary: "#F2F4F8",
          secondary: "#8B93A7",
        }},
        accent: {{
          primary: "#4C8DFF",
        }},
        status: {{
          ok: "#2ECC71",
          warning: "#F5A623",
          critical: "#E5484D",
        }},
        ai: {{
          accent: "#9B6DFF",
        }}
      }},
      fontFamily: {{
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      }},
      borderRadius: {{
        sm: "8px",
        md: "12px",
      }},
      animation: {{
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
    }},
  }},
  plugins: [],
}}