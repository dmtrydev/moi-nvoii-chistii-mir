/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        manrope: ['Manrope', 'Helvetica', 'sans-serif'],
        'adorable-partners-680812-framer-app-DM-sans-medium':
          'var(--adorable-partners-680812-framer-app-DM-sans-medium-font-family)',
        'adorable-partners-680812-framer-app-DM-sans-regular':
          'var(--adorable-partners-680812-framer-app-DM-sans-regular-font-family)',
        'greenx-template-framer-website-DM-sans-medium':
          'var(--greenx-template-framer-website-DM-sans-medium-font-family)',
        'greenx-template-framer-website-inter-medium':
          'var(--greenx-template-framer-website-inter-medium-font-family)',
        'greenx-template-framer-website-inter-regular':
          'var(--greenx-template-framer-website-inter-regular-font-family)',
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
    },
  },
  plugins: [],
};
