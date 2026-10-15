# Design system

These files are the visual foundation for this app. Use them from the first screen.

## Files
- `tailwind.config.js`, `postcss.config.js`: Tailwind 3 setup. Keep Tailwind on v3; this config
  does not work with v4. If you add TypeScript, add ts/tsx to `content`.
- `src/index.css`: the design tokens. Every color is an RGB CSS variable, exposed as a Tailwind color.
- `src/components/ui.jsx`: shared primitives (Btn, Card, Tag, Tooltip, InfoTip, Kbd, Money, Avatar,
  Skeleton, SkeletonRows, EmptyState, Icon, cx). Use them before writing new ones. `Avatar` expects
  `{ initials, tint }`; derive them from a person's name.
- `index.html`: loads the fonts - Newsreader (headings), IBM Plex Sans (body), IBM Plex Mono (figures).
- `reference/SourceDocViewer.jsx`: reference only, written for a different data shape. Reuse the
  ideas (page navigation, zoom, a highlighted matched region, explicit empty states), not the code.

## Rules
1. Colors: token classes only - bg, bgtint, surface, surface2, ink, muted, faint, line, line2,
   slateSoft, and accent / good / warn / ai / danger with -deep, -soft, -fill variants. Never raw
   Tailwind colors (blue-600) or hex values in components. `-fill` sits behind white text; the plain
   tone is for text and borders.
2. Type: semantic sizes only - text-micro (11px), meta (12), body (13), lead (14), title (16),
   display (24), hero (32). No arbitrary sizes like text-[13px]. h1-h3 get the serif automatically.
3. Every amount, date and count uses `.tnum` (or `<Money>`) so columns of figures line up.
4. Flat and square: separate surfaces with `border border-line`, not shadows. Only floating things
   (tooltips, popovers, menus, modals) get `shadow-e3`. `rounded-full` only for dots, avatars and
   progress tracks.
5. Light theme only, on purpose. Do not add dark mode.
6. New components (dense tables, virtualized lists, the document viewer, diffs, timelines) are built
   from these primitives and tokens. New icons go into `Icon` in the same 24px, 1.8 stroke style;
   do not add an icon library.
7. Status is always tone + icon + label, never color alone. Each vocabulary (verification state,
   severity, filing status) has exactly one badge component, and a legend in the app explains it.
8. Permissions: communicate, don't hide. A control the current role can't use stays visible but
   disabled, with a tooltip saying which role can and why. Whole areas that belong to another job
   may be hidden instead.
9. Confidence is not correctness. Show extraction confidence (0-1 in the packet) with good / warn /
   danger tones, but never style a high-confidence unverified value like a verified one. The packet
   contains confident mistakes.
10. No em dashes anywhere: UI copy, code, comments, docs. Use a spaced hyphen " - ".
11. Motion: framer-motion is available. Keep transitions under ~200ms and never delay content to
    simulate loading.
