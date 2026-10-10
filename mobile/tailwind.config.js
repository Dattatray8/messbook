/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#f7f8f5',
        ink: '#17211d',
        muted: '#6f7a73',
        line: '#e4e9e2',
        saffron: { DEFAULT: '#ef8b35', soft: '#fff1e2' },
        leaf: { DEFAULT: '#3d8b69', soft: '#e8f4ed' },
        rose: { DEFAULT: '#c96a69', soft: '#fceceb' },
        sky: { DEFAULT: '#527ba2', soft: '#eaf2f8' },
      },
    },
  },
  plugins: [],
};
