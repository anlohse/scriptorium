/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8f7f4',
          100: '#f0ede6',
          200: '#e0d9cc',
          300: '#c8bcaa',
          400: '#a99880',
          500: '#8c7b62',
          600: '#7a6852',
          700: '#655543',
          800: '#544639',
          900: '#463b31',
          950: '#261f19'
        },
        ink: {
          DEFAULT: '#1a1410',
          muted: '#6b5d4e',
          faint: '#a99880'
        },
        accent: {
          DEFAULT: '#7c5cbf',
          light: '#9d7fe0',
          dark: '#5c3fa0'
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
