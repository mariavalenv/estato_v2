/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        chip: '999px',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        display: ['30px', { lineHeight: '1.2', fontWeight: '500' }],
        heading: ['19px', { lineHeight: '1.3', fontWeight: '500' }],
        body: ['15px', { lineHeight: '1.5', fontWeight: '400' }],
        meta: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      boxShadow: {
        surface: '0 1px 3px 0 rgba(0,0,0,0.12), 0 1px 2px -1px rgba(0,0,0,0.08)',
        card: '0 4px 16px 0 rgba(0,0,0,0.16)',
      },
      keyframes: {
        'orb-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(99,134,241,0.4), 0 0 60px 20px rgba(99,134,241,0.1)',
            transform: 'scale(1)',
          },
          '50%': {
            boxShadow: '0 0 0 10px rgba(99,134,241,0), 0 0 80px 30px rgba(99,134,241,0.15)',
            transform: 'scale(1.06)',
          },
        },
        'orb-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: {
        'orb-pulse': 'orb-pulse 2.5s ease-in-out infinite',
        'orb-ring': 'orb-ring 2.5s ease-out infinite',
      },
    },
  },
  plugins: [],
}
