/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        manrope: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        'adorable-partners-680812-framer-app-DM-sans-medium':
          'var(--adorable-partners-680812-framer-app-DM-sans-medium-font-family)',
        'adorable-partners-680812-framer-app-DM-sans-regular':
          'var(--adorable-partners-680812-framer-app-DM-sans-regular-font-family)',
        'moinoviichistiimir-template-framer-website-DM-sans-medium':
          'var(--moinoviichistiimir-template-framer-website-DM-sans-medium-font-family)',
        'moinoviichistiimir-template-framer-website-inter-medium':
          'var(--moinoviichistiimir-template-framer-website-inter-medium-font-family)',
        'moinoviichistiimir-template-framer-website-inter-regular':
          'var(--moinoviichistiimir-template-framer-website-inter-regular-font-family)',
        'testprojecttttt-framer-website-DM-sans-bold':
          'var(--testprojecttttt-framer-website-DM-sans-bold-font-family)',
        'testprojecttttt-framer-website-DM-sans-medium':
          'var(--testprojecttttt-framer-website-DM-sans-medium-font-family)',
        'testprojecttttt-framer-website-DM-sans-regular':
          'var(--testprojecttttt-framer-website-DM-sans-regular-font-family)',
        'testtestov-framer-website-DM-sans-medium':
          'var(--testtestov-framer-website-DM-sans-medium-font-family)',
        text: 'var(--text-font-family)',
      },
      colors: {
        app: {
          bg: '#F5F7F5',
          muted: '#E8ECE9',
        },
        surface: '#FFFFFF',
        sidebar: {
          DEFAULT: '#1A1A1A',
          muted: '#2D2D2D',
        },
        ink: {
          DEFAULT: '#2D2D2D',
          muted: '#8A8A8A',
        },
        accent: {
          from: '#D4FF5C',
          to: '#5FD93A',
          soft: 'rgba(95, 217, 58, 0.12)',
        },
      },
      boxShadow: {
        'eco-card':
          '0 2px 4px rgba(15, 23, 42, 0.04), 0 12px 28px rgba(15, 23, 42, 0.07), 0 24px 48px rgba(15, 23, 42, 0.05)',
        'eco-card-hover':
          '0 4px 8px rgba(15, 23, 42, 0.06), 0 20px 40px rgba(15, 23, 42, 0.1)',
        'eco-float': '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)',
        'eco-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        'eco-focus': '0 0 0 3px rgba(95, 217, 58, 0.25)',
      },
      backgroundImage: {
        'eco-accent': 'linear-gradient(135deg, var(--tw-gradient-stops))',
      },
      transitionDuration: {
        eco: '240ms',
      },
      transitionTimingFunction: {
        eco: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
