/** @type {import(''tailwindcss'').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#2F455C" },
        secondary: { DEFAULT: "#1565C0" },
        accent: { DEFAULT: "#26A69A" },
        neutral: { DEFAULT: "#263238", light: "#ECEFF1" },
      },
    },
  },
  plugins: [],
}
