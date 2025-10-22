/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{components,services,types}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#6750A4',
        'on-primary': '#FFFFFF',
        'primary-container': '#EADDFF',
        'on-primary-container': '#21005D',
        'secondary': '#625B71',
        'on-secondary': '#FFFFFF',
        'secondary-container': '#E8DEF8',
        'on-secondary-container': '#1D192B',
        'tertiary': '#7D5260',
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#FFD8E4',
        'on-tertiary-container': '#31111D',
        'error': '#B3261E',
        'on-error': '#FFFFFF',
        'error-container': '#F9DEDC',
        'on-error-container': '#410E0B',
        'background': '#FFFBFE',
        'on-background': '#1C1B1F',
        'surface': '#FFFBFE',
        'on-surface': '#1C1B1F',
        'surface-variant': '#E7E0EC',
        'on-surface-variant': '#49454F',
        'outline': '#79747E',
        'shadow': '#000000',
        'inverse-surface': '#313033',
        'inverse-on-surface': '#F4EFF4',
        'inverse-primary': '#D0BCFF',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'background-pan': {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
         'pulse-bright': {
          '0%, 100%': { 'box-shadow': '0 0 10px #D0BCFF, 0 0 20px #EADDFF' },
          '50%': { 'box-shadow': '0 0 20px #D0BCFF, 0 0 40px #EADDFF' }
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'zoom-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-bottom': {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'background-pan': 'background-pan 15s ease infinite',
        'pulse-bright': 'pulse-bright 3s ease-in-out infinite',
        'fade-in-right': 'fade-in-right 0.6s ease-out forwards',
        'fade-in-left': 'fade-in-left 0.6s ease-out forwards',
        'zoom-in': 'zoom-in 0.5s ease-out forwards',
        'slide-in-bottom': 'slide-in-bottom 0.6s ease-out forwards',
      }
    }
  },
  plugins: [],
}
