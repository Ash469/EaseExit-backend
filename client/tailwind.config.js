module.exports = {
  mode: 'jit',
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A3E72',
        accent:  '#FBBF24',
      },
      fontFamily: {
        // 'playfair' becomes the class `font-playfair`
        playfair: ['"Playfair Display"', 'serif'],

        // if you self-hosted:
        sexy: ['"MyCoolFont"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
