/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        idf: {
          light: '#f3f4f0',
          primary: '#4a5d4e', // IDF Olive
          dark: '#2c362e',
          accent: '#c5a059', // Gold/Brass accent
        }
      },
      fontFamily: {
        heebo: ['Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
