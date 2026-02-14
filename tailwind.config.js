/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "serif"]
      },
      colors: {
        night: "#0b0f1a",
        surface: "#111827",
        panel: "#0f172a",
        ink: "#e2e8f0",
        muted: "#94a3b8",
        neon: "#4ade80",
        glow: "#38bdf8",
        ember: "#f97316",
        lavender: "#a78bfa"
      },
      boxShadow: {
        glow: "0 0 40px rgba(56, 189, 248, 0.2)",
        card: "0 20px 60px rgba(2, 6, 23, 0.5)"
      },
      backgroundImage: {
        aurora:
          "radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(249, 115, 22, 0.2), transparent 45%), radial-gradient(circle at 30% 80%, rgba(167, 139, 250, 0.2), transparent 45%)"
      }
    }
  },
  plugins: []
};
