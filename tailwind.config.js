/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        dinary: {
          background: '#F8F6F0', surface: '#FFFFFF', muted: '#F1EFE7',
          primary: '#0F766E', 'primary-dark': '#115E59', 'primary-soft': '#CCFBF1',
          accent: '#D97706', 'accent-soft': '#FEF3C7', income: '#16A34A',
          expense: '#DC2626', text: '#111827', 'text-muted': '#6B7280', border: '#E5E7EB',
        },
      },
    },
  },
  plugins: [],
};
