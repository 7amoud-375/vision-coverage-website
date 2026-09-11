/** @type {import('tailwindcss').Config} */
// ---------------------------------------------------------------------------
// Reskin point: change the palette / fonts here and the whole site follows.
// Every component uses semantic names (bg-surface, text-muted, bg-accent...)
// rather than raw Tailwind colours, so a rebrand is a one-file edit.
// ---------------------------------------------------------------------------
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0b0b0d',       // page background
        surface: '#141417',    // cards / panels
        'surface-2': '#1d1d21',// hover / raised panels
        line: '#2a2a30',       // borders
        ink: '#f4f4f5',        // primary text
        muted: '#a1a1aa',      // secondary text  (6.7:1 on surface-2)
        subtle: '#8f8f98',     // placeholders / hints (5.1:1 on surface-2)
        faint: '#85858e',      // genuinely inactive text (5.1:1 on surface)
        accent: '#c9a227',     // brand accent (buttons, highlights)
        'accent-soft': '#e0bd4a',
        success: '#3f9e6b',
        danger: '#c2544d',
        'danger-soft': '#e08a83', // red text on dark surfaces (6.3:1 on surface-2)
        warn: '#c9922b',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      maxWidth: {
        content: '1200px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s ease-out both',
      },
    },
  },
  plugins: [],
}
