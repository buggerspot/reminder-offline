/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors: { brand: '#0F766E', mint: '#D1FAE5', ink: '#102A2A' } } },
  plugins: [],
};
