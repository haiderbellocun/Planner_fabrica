import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  // Los estilos :hover solo se aplican en dispositivos con puntero real (sin hover pegado en tactil).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          deep: "hsl(var(--primary-deep))",
        },
        coral: {
          DEFAULT: "hsl(var(--coral))",
          foreground: "hsl(var(--coral-foreground))",
          tint: "hsl(var(--coral-tint))",
          strong: "hsl(var(--coral-strong))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          strong: "hsl(var(--destructive-strong))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          strong: "hsl(var(--success-strong))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          strong: "hsl(var(--warning-strong))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          strong: "hsl(var(--info-strong))",
        },
        status: {
          pending: "hsl(var(--status-pending))",
          "in-progress": "hsl(var(--status-in-progress))",
          "in-review": "hsl(var(--status-in-review))",
          completed: "hsl(var(--status-completed))",
        },
        priority: {
          low: "hsl(var(--priority-low))",
          medium: "hsl(var(--priority-medium))",
          high: "hsl(var(--priority-high))",
          urgent: "hsl(var(--priority-urgent))",
        },
        sage: "hsl(var(--sage))",
        sand: "hsl(var(--sand))",
        lavender: {
          DEFAULT: "hsl(var(--lavender))",
          light: "hsl(var(--lavender-light))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", '"SF Mono"', '"Cascadia Code"', "Consolas", "monospace"],
      },
      // Dos niveles de elevacion: card = superficie en reposo, floating = hover / menus / popovers.
      // card-hover se conserva como alias de floating para no romper referencias existentes.
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06)",
        floating: "0 8px 24px rgba(10,20,20,0.10)",
        "card-hover": "0 8px 24px rgba(10,20,20,0.10)",
      },
      // Espaciado semantico sobre la rejilla de 4px de Tailwind:
      // card = relleno interno de tarjetas (20px), section = separacion entre bloques (32px), page = margen de pagina (40px).
      spacing: {
        card: "1.25rem",
        section: "2rem",
        page: "2.5rem",
      },
      // Escala tipografica: 2xs (11px) es el minimo legible; el resto sigue la escala de Tailwind
      // (xs 12 / sm 14 / base 16 / lg 18 / xl 20 / 2xl 24 / 3xl 30).
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      // Movimiento: ease-out fuerte por defecto; duraciones press 150 / ui 200 / panel 250.
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.23, 1, 0.32, 1)",
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        press: "150ms",
        ui: "200ms",
        panel: "250ms",
      },
      // Sustituto acotado de transition-all: solo las propiedades que cambian en la UI.
      transitionProperty: {
        ui: "color, background-color, border-color, box-shadow, opacity, transform",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
