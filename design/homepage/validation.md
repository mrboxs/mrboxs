# Homepage design validation

Result: **PASS for the FigCraft design scope**. This is a design artifact with
prototype actions, not a deployed homepage. Runtime-only checks are explicitly
listed as not applicable below; they are not represented as browser test passes.

## Measured checks

| Artboard | Size        | Visible text layers | Text outside its frame | Targets below 44 px | Lowest text contrast |
| -------- | ----------- | ------------------- | ---------------------- | ------------------- | -------------------- |
| Desktop  | 1440 × 3150 | 74                  | 0                      | 0                   | 5.16:1               |
| Tablet   | 834 × 3150  | 69                  | 0                      | 0                   | 5.16:1               |
| Mobile   | 390 × 3878  | 67                  | 0                      | 0                   | 5.16:1               |

Bounds were checked against each text layer's containing frame using FigCraft's
reported absolute coordinates. The profile's deliberate overlap is represented
by overlapping section frames, with its text still inside its own container.
Contrast uses the WCAG 2.x relative luminance formula and the nearest solid
background. Decorative logo strokes and footer outlines are not text.

The native layer trees and prototype action definitions were inspected. All
three artboards, the hover/pressed artwork, the brand menu, and the design notes
were rendered or exported and visually checked. Fonts are available: 2 families,
0 missing fonts. Raw checks are in
[layout-validation.json](/home/mrboxs/dev/work/mrboxs/design/homepage/layout-validation.json).

Source repository checks, with application source unchanged:

- `vp install`: passed; no generated files changed.
- `vp check`: passed; no warnings, lint errors, or type errors in 21 source files.
- `vp test`: passed; 1 test file, 4 tests.

Prototype actions include section scrolling, actual external destinations,
brand-menu and project overlays, closing via buttons/Escape, and logo variant
changes. Action configuration was inspected; no browser click-through of an
implemented homepage is claimed. Native DOM semantics, clipboard operations,
pointer-tracking highlights, and screen-reader announcements require the
homepage implementation and are outside this FigCraft-only request.

## Anti Slop delivery gate

Antislop During was explicitly selected by the owner. Reading: a compact
personal developer portfolio in the supplied monochrome editorial style.
ENERGY 1 / RHYTHM 2 / MOTION 1.

### Hard gate

- R-02 PASS: all 210 visible homepage text layers were scanned; no em dashes.
- R-03 PASS: the table above records zero text overflow and zero targets smaller
  than 44 px across the three deliberately composed artboards.
- R-17 PASS: the only project count describes the three actual works shown;
  there are no invented activity, traffic, follower, or performance statistics.
- R-18 PASS: no testimonials, invented employers, or fictional people.
- R-23 PASS: original brandkit assets, existing isometric geometry, the supplied
  reference, and the owner's real GitHub avatar are used.
- R-24 PASS: Work, Stack, About, selected work, and Back to top point to existing
  section layers. External targets use real profile/repository/asset paths.
- R-25 PASS: measured minimum normal-text contrast is 5.16:1. The white focus
  specimen and the outlined secondary action have high-contrast boundaries.
- R-26 PASS in prototype scope: actionable controls have native prototype
  actions; text-only technology tags are informational. No clipboard behavior
  is implied by the menu's accurately labeled View SVG actions.
- R-27 PASS in static-content scope: no network-fed heatmap, articles, or client
  feed is introduced, so loading, empty, and error workflows are not applicable.
- R-28 PASS: no template FAQ.
- R-32 PASS in design scope: minimum target sizes, focus-ring specimens,
  Escape-to-close definitions, and reading-order guidance are provided. DOM
  keyboard traversal is not applicable to this native canvas artifact.
- R-33 PASS: FigCraft commands authored the page layers. Derived SVG state
  assets were generated from existing exported geometry; no application source
  or stylesheet was patched by an external script.
- R-34 PASS: no theme toggle is presented. The owner explicitly supplied a dark
  reference; this deliverable consistently designs that requested theme.
- R-35 PASS in design scope: native renders and exports were inspected; source
  checks/tests passed. Runtime homepage build and click-through are not
  applicable because this request does not implement the homepage.
- R-36 PASS: no security, customer, compliance, or speed claims. Validation
  numbers come from inspected layers and executed commands.
- R-37 PASS: explicit reference, existing identity, and dials are recorded.
- R-38 PASS: project descriptions come from the real code, plugin, and brandkit.
  The proposed personal prose is identified as draft copy in the README.
- R-39 PASS in design scope: 44 px targets, labeled menu actions, visible control
  specimens, close actions, and reduced-motion guidance are supplied. HTML/ARIA
  for the future homepage is not claimed as implemented.
- R-40 PASS in artifact scope: raster previews declare dimensions. Native
  artwork has fixed view boxes; no remote scripts or unsized runtime embeds
  are introduced into the application.

### Purpose gate

- R-01 PASS: a single radial highlight is confined to each requested logo
  interaction state; it reveals the contours, rather than coloring the page.
- R-04 PASS: the real logo carries identity; location, code, GitHub, close, and
  external-link symbols identify their actual content or action.
- R-06 PASS: Outfit and Geist match the existing project fonts. Uppercase micro
  labels identify a project/edition/view; headings and body remain proportional.
- R-07 PASS: content rails and section rules expose alignment; the hero's few
  diagonals refer to the specific isometric mark, not a repeating stock grid.
- R-08 PASS: external arrows distinguish off-site links; the main section CTA
  is labeled View selected work and has no decorative arrow.
- R-09 PASS: no promotional pills, unsupported status lights, or AI badges.
- R-10 PASS: no glass blur.
- R-12 PASS: only the floating brand menu has a shadow, expressing its overlay.
- R-13 PASS: no card, page, badge, or button glow; only the logo has a highlight.
- R-14 PASS: a wide plugin preview and two smaller project covers express
  hierarchy; intro and stack use prose/rows, not repeated feature cards.
- R-19 PASS: pointer-triggered hover and press only; the specification disables
  morphing under reduced motion. No automatic loops or entrances.
- R-22 PASS: the illustration is the owner's own brand geometry and is also the
  actual artifact used by the showcased logo component.

### Liveliness

- Dials PASS: ENERGY 1, RHYTHM 2, MOTION 1 are declared before design and in-file.
- Consistency PASS: quiet monochrome treatment, alternating text/artwork/rows,
  and restrained user-triggered logo states match those dials.
- Focal point PASS: the opening uses the large native isometric mark; Selected
  work gives the plugin the widest preview; later sections use one clear heading.
- Whitespace PASS: fixed column insets align prose, covers, metadata, and rows;
  gaps separate sections rather than filling a viewport.
- Accent PASS: the white View selected work action is the main contrast accent.
- Identity PASS: original symbol, isometric artwork, actual wordmark, and outline
  footer recur across the page and differ from the reference owner's identity.
- Design Read PASS: audience, visual language, and dials are recorded in README
  and the native notes board.

### Craftsmanship and quality locks

- C-1 PASS: major decisions have one-line reasons in the README.
- C-2 PASS in prototype scope: section links, overlays, and external destinations
  are defined; runtime clipboard, sound, and browser semantics are scoped out.
- C-3 PASS: identity, actual work, existing UI details, tools, and social links
  determine section order. No unsupported career or marketing sections.
- C-4 PASS in design scope: desktop, tablet, and mobile are rendered; text bounds,
  target sizes, focus specimens, and motion guidance are checked/provided.
- C-5 PASS: no invented clients, articles, people, employment, or metrics.
- R-05 PASS: prose, a featured project, paired covers, UI demos, and compact tool
  rows vary the rhythm in response to their actual content.
- R-11 PASS: 4/6/8/10 px corner scale is recorded and used by role.
- R-15 PASS: View selected work, View symbol SVG, Brand guidelines, Download
  brandkit, and Back to portfolio describe their destinations/actions.
- R-16 PASS: copy uses plain project descriptions rather than marketing claims.
- R-20 PASS: actual mrboxs contours, wordmark, avatar, and projects give the page
  the owner's identity.
- R-21 PASS: the supplied dark reference determines the delivered theme.
- R-29 PASS: monochrome canvas, surfaces, text hierarchy, and a white action;
  no additional hue palette.
- R-30 PASS: the requested reference informs density/rails; mrboxs assets and
  actual content determine the result. The reference owner's biography,
  achievements, sponsors, and activity graph are not copied.
- R-31 PASS: palette, layout, type, spacing, cards, imagery, radius, shadows,
  arrows, and motion all have explicit reasons in the README.

## Implementation limits

FigCraft provides the composed artboards, vector/text editing, components,
variants, and prototype wiring. It does not prove browser responsiveness,
keyboard navigation, focus management, 200% text zoom, or screen-reader behavior
for the future React homepage. Those must be verified when that separate
implementation is requested. The HTML companion switches between native PNG
exports; it is a review aid, not the portfolio application.
