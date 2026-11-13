# mrboxs isometric spotlight

The existing mrboxs symbol is projected onto an isometric plane with 26 px of
thickness, thin edges and diagonal surface hatching. It is an illustrative
website variant; the original brandkit symbol remains unchanged.

## Source and editable design

- [Brandkit source](https://github.com/mrboxs/mrboxs-brandkit/blob/fb83810ece286280087cbfc35758c8013fde3bf8/01-logos/inline/mrboxs-symbol-currentcolor.svg), pinned to commit `fb83810ece286280087cbfc35758c8013fde3bf8`.
- [Original SVG](/home/mrboxs/dev/work/mrboxs/design/mrboxs-isometric/brandkit-original.svg).
- [Editable FigCraft file](/home/mrboxs/dev/work/mrboxs/design/mrboxs-isometric/mrboxs-isometric.figcraft).
- [SVG export](/home/mrboxs/dev/work/mrboxs/design/mrboxs-isometric/mrboxs-isometric-dark.svg).
- [Exported geometry](/home/mrboxs/dev/work/mrboxs/design/mrboxs-isometric/geometry.json).
- [React geometry asset](/home/mrboxs/dev/work/mrboxs/src/assets/mrboxs-isometric.ts).
- [Spotlight component](/home/mrboxs/dev/work/mrboxs/src/components/custom/mrboxs-spotlight-logo.tsx).

The design was made in the running FigCraft app before changing the React
component, using the installed **Isometric** plugin's Top view at 30 degrees.
Visible walls were refined in FigCraft, including the interior of the B cutout.
The file contains the source symbol, dark and light artboards, a pressed state,
and the reference supplied by the user.

The website uses those exported paths. Nineteen visible side faces have matched
normal/pressed path commands. The top moves down 13 px while the bottom vertices
stay fixed. Pointer hover reveals a following highlight; keyboard focus reveals
the same highlight. Enter and Space activate the native button. The existing
click sound is retained. Reduced motion disables the press morph and cursor
tracking, with an immediate highlight transition.

## Visual direction

Antislop mode: During, selected in this conversation.

Reading this as a monochrome, interactive brand illustration for the existing
mrboxs site. ENERGY 1 / RHYTHM 1 / MOTION 1.

- Existing foreground/background tokens match the current site and its two themes.
- Surface hatching follows the user's explicit reference and separates top faces
  from the extrusion; it is not a page background decoration.
- The radial highlight identifies the pointer/focus location on the logo edges.
- A short spring press makes thickness tangible without automatic looping motion.
- All branding contours come from the supplied source, including the B hole.
- The original viewBox aspect ratio, explicit dimensions and responsive wrapper
  avoid layout shifts and horizontal overflow.
- This detailed artwork is not a replacement for the brandkit's small favicon.

## Validation

- Production build: passed with `vp run build`.
- Type checking: passed with `vp run typecheck`.
- Tests: `vp test`, 4 passed.
- Lint for the three changed source files: passed.
- Formatting and whitespace: checked with Vite+ and `git diff --check`.
- Browser checks: 8 passed in real headless Chromium against the local app,
  covering exact FigCraft path integration, pointer tracking, press/release,
  Tab/Space and visible focus, light theme, a 390 px touch viewport, reduced
  motion, and absence of component/hydration exceptions.

Project-wide `vp check` is blocked by six pre-existing errors in
[brand-assets-menu.tsx](/home/mrboxs/dev/work/mrboxs/src/components/custom/brand-assets-menu.tsx):
two floating clipboard promises and four anchor-label/content diagnostics.
Those staged changes were left intact. React Doctor reports only findings in
that file and the existing toast component; the logo's previous full-Motion
import warning is resolved. Its aggregate score changed from 69 to 68 despite
the diagnostic count decreasing from six to five; no new logo finding appeared.
The existing missing `/favicon.ico` produces a separate 404 in the local app.

## Antislop delivery gate

Result: **PASS for the changed logo and its responsive wrapper**. Existing
project diagnostics above are recorded separately, not represented as a clean
project-wide check.

- R-02 PASS: labels and notes use plain punctuation.
- R-03 PASS: Chromium verified a 390 px viewport with no horizontal overflow.
- R-17 PASS: no invented statistics; validation counts are measured.
- R-18 PASS: no testimonials or fabricated people.
- R-23 PASS: uses the user's actual brand symbol and supplied reference.
- R-24 PASS: no new navigation or placeholder links.
- R-25 PASS within artwork scope: faint strokes are the explicitly requested
  decorative linework, not text or the sole control indicator; the named native
  button has a full-foreground, 2 px keyboard focus ring.
- R-26 PASS: hover, pointer press, native click, Tab, Space and touch were exercised.
- R-27 PASS: the illustration renders immediately on the server; it has no data
  loading or empty-state workflow. No component errors were reported.
- R-28 PASS: no FAQ or filler copy.
- R-32 PASS: native named button, Tab reachability and visible focus verified.
- R-33 PASS: component/data source changes were written directly; FigCraft was
  used to author and export the vector design.
- R-34 PASS: light and dark rendering inspected; colors use semantic tokens.
- R-35 PASS: production build, tests and recorded browser interaction checks run.
- R-36 PASS: no unmeasured performance or compliance claims.
- R-37 PASS: explicit reference, existing brand and dials recorded above.
- R-38 PASS: no fabricated product or customer content.
- R-39 PASS: native button, accessible name, pointer cursor, hover/focus/press
  states, and reduced-motion handling verified.
- R-40 PASS: explicit SVG dimensions; no added remote media or scripts.
- R-01 PASS: the gradient is an interaction highlight on the requested artwork.
- R-04 PASS: no generic decorative icons.
- R-06 PASS: no added typography or spaced uppercase labels.
- R-07 PASS: hatching is confined to the requested logo surfaces.
- R-08 PASS: no decorative CTA arrows.
- R-09 PASS: no badges or promotional labels.
- R-10 PASS: no added glass panels.
- R-12 PASS: extrusion is actual geometry; no added floating card shadows.
- R-13 PASS: highlight is confined to the logo's edges.
- R-14 PASS: no feature-card layout.
- R-19 PASS: only user-triggered hover/focus/press; no autonomous animation.
- R-22 PASS: actual brand geometry rather than a generic illustration.
- Liveliness PASS: declared dials, the logo as focal point, clear space, a single
  interaction highlight and the original brand contours as the identity motif.
- C-1 / R-31 PASS: color, hatching, geometry and motion have explicit reasons above.
- C-2 PASS: the single native control has real behavior.
- C-3 / R-05 PASS: no extra website sections or template layout added.
- C-4 PASS: responsive, two-theme, keyboard and reduced-motion states checked.
- C-5 PASS: no fabricated claims or content.
- R-11 PASS: retains the existing small-radius focus target; no pill styling.
- R-15 PASS: the accessible action names the logo sound it plays.
- R-16 PASS: no marketing buzzwords.
- R-20 PASS: artwork uses the user's own symbol.
- R-21 PASS: follows the site's existing theme choice.
- R-29 PASS: existing monochrome foreground/background palette only.
- R-30 PASS: uses the supplied interaction/style reference with mrboxs geometry.
