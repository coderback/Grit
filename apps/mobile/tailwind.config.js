/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'grit-orange': '#FF5C2B',
        'grit-dark': '#0D0D0D',
        'grit-surface': '#1A1A1A',
        'grit-surface-2': '#252525',
        'grit-text': '#F5F0EB',
        'grit-muted': '#8A8580',
        'grit-success': '#4CAF82',
        'grit-blue': '#4B9FFF',
        'grit-border': '#2E2E2E',
      },
      fontFamily: {
        display: ['ClashDisplay-Semibold', 'sans-serif'],
        body: ['DMSans-Regular', 'sans-serif'],
        'body-medium': ['DMSans-Medium', 'sans-serif'],
        'body-bold': ['DMSans-Bold', 'sans-serif'],
        mono: ['JetBrainsMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        input: '12px',
      },
    },
  },
  plugins: [],
};
