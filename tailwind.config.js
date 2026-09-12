/** @type {import('tailwindcss').Config} */
// ---------------------------------------------------------------------------
// Reskin point: change the palette / fonts here and the whole site follows.
// Every component uses semantic names (bg-surface, text-muted, bg-accent...)
// rather than raw Tailwind colours, so a rebrand is a one-file edit.
//
// Tuned to the Vision Zekra identity: true black, pure white, geometric sans,
// no decorative colour. The only hues left are functional - they carry meaning
// in the calendar and in status badges, where relying on brightness alone would
// fail both contrast and colour-blind readers.
// ---------------------------------------------------------------------------
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#000000',       // page background - the logo's own black
        surface: '#0b0b0d',    // cards / panels
        'surface-2': '#15151a',// hover / raised panels
        line: '#26262d',       // borders
        ink: '#ffffff',        // primary text
        muted: '#a1a1aa',      // secondary text  (6.9:1 on surface-2)
        subtle: '#8f8f98',     // placeholders / hints (5.3:1 on surface-2)
        faint: '#85858e',      // genuinely inactive text (4.7:1 on surface-2)

        // Brand "accent" is simply white: primary buttons are white on black,
        // which is the identity rather than a decoration on top of it.
        accent: '#ffffff',
        'accent-soft': '#d4d4d8',

        // Functional only - never used as brand colour.
        success: '#3f9e6b',
        danger: '#c2544d',
        'danger-soft': '#e08a83', // red text on dark surfaces (6.6:1 on surface-2)
        warn: '#c9922b',
      },
      fontFamily: {
        // Montserrat matches the wordmark's geometric letterforms; the serif
        // that was here before read as a completely different brand.
        display: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        brand: '0.3em',
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
