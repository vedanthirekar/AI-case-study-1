/** @type {import('tailwindcss').Config} */

// Every colour resolves to a CSS custom property defined in src/index.css, so
// re-theming the product is a matter of editing that one token block rather
// than touching any component. The product ships a single (light) palette -
// see the note above the tokens for why.
const t = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: t('--c-bg'),
        bgtint: t('--c-bgtint'),
        surface: t('--c-surface'),
        surface2: t('--c-surface2'),
        ink: t('--c-ink'),
        muted: t('--c-muted'),
        faint: t('--c-faint'),
        line: t('--c-line'),
        line2: t('--c-line2'),
        slateSoft: t('--c-slate-soft'),

        accent: { DEFAULT: t('--c-accent'), deep: t('--c-accent-deep'), soft: t('--c-accent-soft'), fill: t('--c-accent-fill') },
        good: { DEFAULT: t('--c-good'), deep: t('--c-good-deep'), soft: t('--c-good-soft'), fill: t('--c-good-fill') },
        warn: { DEFAULT: t('--c-warn'), deep: t('--c-warn-deep'), soft: t('--c-warn-soft'), fill: t('--c-warn-fill') },
        ai: { DEFAULT: t('--c-ai'), deep: t('--c-ai-deep'), soft: t('--c-ai-soft'), fill: t('--c-ai-fill') },
        danger: { DEFAULT: t('--c-danger'), deep: t('--c-danger-deep'), soft: t('--c-danger-soft'), fill: t('--c-danger-fill') },

        // dark chips / tooltips / overlays - always light text on top
        inverse: { DEFAULT: t('--c-inverse'), fg: t('--c-inverse-fg') },
        scrim: t('--c-scrim'),
      },
      // D1 "Ledger": a serif for headings over a humanist sans, with tabular mono
      // for every figure. A tax return is a printed instrument; the type says so.
      fontFamily: {
        display: ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      // Semantic type scale - replaces ad-hoc text-[13.5px] literals.
      // Display sizes run larger than the sans-serif original: the serif carries
      // more weight per pixel and wants the room.
      fontSize: {
        micro: ['11px', { lineHeight: '1.45' }],
        meta: ['12px', { lineHeight: '1.5' }],
        body: ['13px', { lineHeight: '1.55' }],
        lead: ['14px', { lineHeight: '1.55' }],
        title: ['16px', { lineHeight: '1.32', letterSpacing: '0' }],
        display: ['24px', { lineHeight: '1.2', letterSpacing: '0' }],
        hero: ['32px', { lineHeight: '1.14', letterSpacing: '-0.01em' }],
      },
      // Print precision: near-square everywhere. `rounded-full` is deliberately
      // left alone - avatars, status dots and progress tracks stay circular.
      borderRadius: {
        sm: '2px', DEFAULT: '2px', md: '2px', lg: '2px', xl: '3px', '2xl': '3px',
        xl2: '2px', xl3: '3px',
      },
      // Rules, not shadows. e1/e2 are flat by design - every card already carries
      // `border border-line`, which is what separates it now. e3 survives because
      // things that genuinely float (tooltips, popovers, the tour card, modals)
      // still need to detach from the page to stay legible.
      boxShadow: {
        e1: 'none',
        e2: 'none',
        e3: '0 10px 30px rgb(var(--shadow-rgb) / var(--shadow-a3))',
        // legacy aliases kept so existing screens don't need touching
        soft: 'none',
        pop: '0 10px 30px rgb(var(--shadow-rgb) / var(--shadow-a3))',
        glow: '0 0 0 3px rgb(var(--c-accent) / .18)',
        brand: 'none',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(var(--c-accent) / .45)' }, '100%': { boxShadow: '0 0 0 12px rgb(var(--c-accent) / 0)' } },
        flash: { '0%,100%': { background: 'transparent' }, '30%': { background: 'rgb(var(--c-good) / .16)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        barSlide: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        fade: 'fadeUp .22s cubic-bezier(.2,.7,.3,1) both',
        pulsering: 'pulseRing .9s ease-out',
        flash: 'flash 1.1s ease-out',
        barslide: 'barSlide .9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
