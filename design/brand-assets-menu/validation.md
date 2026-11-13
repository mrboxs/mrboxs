# Brand assets menu demo

Result: **PASS for this integration**.

The demo in [index.tsx](/home/mrboxs/dev/work/mrboxs/src/routes/index.tsx)
uses the original mrboxs symbol as a Home link and a context-menu trigger.
The existing isometric illustration remains below it. Both clipboard strings
come from the inline SVG files in the user's brandkit, pinned to commit
`fb83810ece286280087cbfc35758c8013fde3bf8`.

The guidelines file and release ZIP were checked over HTTP: both returned 200,
and the download returned a valid ZIP signature. No external tab was needed.

## Validation

- `vp run verify`: production build, formatting, lint/type checking and 4 tests.
- Ten Chromium checks passed: original logo and all four actions; real link
  destinations; exact logomark clipboard content; exact wordmark clipboard
  content; Shift+F10/Escape and restored focus; clipboard-denied feedback;
  mobile long press, 48 px target and no overflow at 390 px; light/dark themes;
  reduced popup motion and pointer cursors; no component/hydration exceptions.
- React Doctor's existing menu anchor warnings were removed. Its remaining
  diagnostics concern the pre-existing toast component; no new menu finding.
- The existing missing favicon was recorded separately from component errors.

## Design and delivery gate

Antislop: During, as selected in this conversation. Read as a native brand-menu
demo following the supplied example, using the existing site typography and
semantic colors. ENERGY 1 / RHYTHM 1 / MOTION 1.

- R-02 PASS: plain action labels; no decorative punctuation.
- R-03 PASS: mobile long press, 48 px target and 390 px viewport checked.
- R-17 PASS: only measured validation counts; no marketing statistics.
- R-18 PASS: no invented people or testimonials.
- R-23 PASS: the user's actual symbol and outlined wordmark are used.
- R-24 PASS: Home is a typed TanStack link; both external destinations exist.
- R-25 PASS within native-token scope: existing foreground, muted-foreground
  and popover colors are retained; no custom low-contrast text colors added.
- R-26 PASS: both clipboard actions, external link attributes and popup controls checked.
- R-27 PASS: success is shown only after copying; denied access has an error message.
- R-28 PASS: no FAQ or filler content.
- R-32 PASS: Home has an accessible name; Shift+F10 and Escape tested.
- R-33 PASS: source changes written directly; SVGs copied from the brandkit.
- R-34 PASS: light and dark screenshots inspected.
- R-35 PASS: build, checks, tests and browser walkthrough completed.
- R-36 PASS: no invented performance or compliance claims.
- R-37 PASS: supplied demo is the design direction; dials recorded above.
- R-38 PASS: no fictional brand data or placeholder asset links.
- R-39 PASS: named native link/menu actions, pointer cursors, focus behavior,
  error feedback and reduced-motion popup behavior verified.
- R-40 PASS: intrinsic SVG dimensions; no added third-party scripts or remote images.
- R-01 PASS: no new gradients or glows.
- R-04 PASS: the user's logo and existing icons identify specific actions.
- R-06 PASS: existing typography; no decorative uppercase or monospace.
- R-07 PASS: no new background grid or texture.
- R-08 PASS: no decorative CTA arrows.
- R-09 PASS: no badges.
- R-10 PASS: no added glass panels.
- R-12 PASS: the existing popup shadow distinguishes the menu from page content.
- R-13 PASS: no new glow treatment.
- R-14 PASS: actions are a native grouped menu, not feature cards.
- R-19 PASS: existing popup transition disabled for reduced motion.
- R-22 PASS: actual brand SVGs, not generic illustrations.
- Liveliness PASS: the logo is the trigger, spacing separates its hint, the
  native highlighted action supplies focus, and the original mark supplies identity.
- C-1 / R-31 PASS: layout follows the supplied demo; colors and typography match
  the site; grouping separates clipboard actions from external resources.
- C-2 PASS: every action has working behavior and appropriate failure feedback.
- C-3 / R-05 PASS: only the requested demo and its hint were added.
- C-4 PASS: keyboard, touch, themes, denied clipboard and reduced motion tested.
- C-5 PASS: authentic assets and verified destinations.
- R-11 PASS: existing native control radii retained.
- R-15 PASS: action labels name exactly what they do.
- R-16 PASS: no marketing buzzwords.
- R-20 PASS: the demo uses mrboxs's own symbol and asset kit.
- R-21 PASS: existing theme selection respected.
- R-29 PASS: existing semantic palette only.
- R-30 PASS: follows the user's supplied component example with mrboxs assets.
