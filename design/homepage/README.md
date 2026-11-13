# mrboxs portfolio homepage

Editable FigCraft design based on the owner's supplied monochrome portfolio
reference and the existing isometric-logo work. Created on 13 November 2026.

## Deliverables

- [Editable FigCraft file](/home/mrboxs/dev/work/mrboxs/design/homepage/mrboxs-homepage.figcraft)
- [Desktop PNG, 1440 × 3150](/home/mrboxs/dev/work/mrboxs/design/homepage/desktop.png)
- [Tablet PNG, 834 × 3150](/home/mrboxs/dev/work/mrboxs/design/homepage/tablet.png)
- [Mobile PNG, 390 × 3878 at 2×](/home/mrboxs/dev/work/mrboxs/design/homepage/mobile.png)
- [Interactive image preview](/home/mrboxs/dev/work/mrboxs/design/homepage/preview.html)
- [Design notes and interaction states](/home/mrboxs/dev/work/mrboxs/design/homepage/design-notes.png)
- [Brand menu](/home/mrboxs/dev/work/mrboxs/design/homepage/brand-menu.png)
- [Validation and Anti Slop gate](/home/mrboxs/dev/work/mrboxs/design/homepage/validation.md)

The website implementation was not changed. These are native, editable text,
vector, frame, component, and instance layers, not flattened page screenshots.
The PNGs are exports of the FigCraft file. The HTML only displays those exports.

## In FigCraft

Page `01 · Homepage` contains desktop, mobile, and tablet artboards with named
prototype flows. The small header logo and the brand-menu demonstration open
the asset overlay. Work, Stack, About, and Back to top have scroll destinations.
Project cards open their actual repository or the Isometric project overlay.
Social links open the public GitHub and X profiles.

Page `02 · Components & states` contains the original symbol, inverse symbol,
wordmark, outline wordmark, three logo variants, asset overlay, two project
overlays, and a design-system board. The logo variant property is `State` with
`Idle`, `Hover`, and `Pressed` values. Pointer enter, leave, down, and up have
variant-change interactions. The original logo geometry is reused, including
the 26 px extrusion and 13 px press displacement.

The design prototype uses a fixed highlight to represent hover. Cursor-following
spotlight, sound, clipboard access, DOM semantics, native keyboard focus, and
reduced-motion behavior belong to the existing React components and the future
homepage implementation. They are not simulated by these raster previews.

Both fonts are available in the current FigCraft session. On another machine,
load [Outfit](/home/mrboxs/dev/work/mrboxs/design/homepage/fonts/Outfit.ttf) and
[Geist](/home/mrboxs/dev/work/mrboxs/design/homepage/fonts/Geist.ttf) with
`Text > Load font file` if necessary. OFL licenses are alongside the fonts.

## Design decisions

Reading this as a personal developer portfolio for visitors reviewing the
owner's work, using the supplied quiet, monochrome, editorial visual language.
Antislop During was selected by the owner in this session.
ENERGY 1 / RHYTHM 2 / MOTION 1.

- Color: the owner's black-and-white brand and dark reference determine the
  palette; the white primary action is the single high-contrast accent.
- Layout: an 832 px content rail keeps the compact personal-page character of
  the reference, with a 768 px inner column and section labels in the wide gutter.
- Background lines: vertical rails and section rules expose the content
  structure; the hero's few diagonals echo the actual isometric geometry.
- Typography: Outfit matches the existing site's body font; Geist gives dense
  section headings and small labels a clear, consistent structure.
- Spacing: 32 px desktop and 24 px mobile insets keep text aligned; project
  covers, text sections, and compact stack rows use different vertical rhythms.
- Cards: project artwork needs bounded previews; the intro and stack use text
  and rows instead of repeating card grids.
- Imagery: the header/footer use original brandkit vectors, the hero and plugin
  cover use the existing logo design, and the avatar comes from the owner's
  public GitHub profile with a monochrome adjustment in FigCraft.
- Arrows identify external destinations; the primary section action has none.
- Radius: 4 px tags, 6 px controls, 8 px project cards, 10 px overlays.
- Elevation: only the floating asset overlay uses a shadow.
- Motion: user-triggered hover/press only, with a 120 ms dissolve for hover and
  an immediate pressed state. No automatic loops.
- Content: identity, projects, small UI details, tools, then social links. There
  are no invented jobs, clients, articles, contribution charts, or testimonials.

## Responsive handoff

- At 1152 px and wider, keep the centered 832 px rail and show gutter labels.
- From 834 to 1151 px, keep the same rail and hide gutter labels. The tablet
  artboard demonstrates the narrowest two-column composition.
- Below 834 px, use one-column projects and workbench cards, a 24 px inner
  inset, stacked metadata, and compact header links. The mobile artboard is
  390 px wide. Keep the content fluid and capped at the desktop rail width.
- At widths below the mobile sample, let the two introductory actions wrap
  and retain at least 44 px hit areas; do not shrink labels to force a fit.
- At 200% text zoom, let text/section heights grow. Keep source order identical
  to reading order and avoid clipping containers around text.

## Content sources

- [Public GitHub profile](https://github.com/mrboxs): display name, handle,
  Indonesia location, avatar, and the linked X handle. Queried via GitHub API.
- [Website repository](https://github.com/mrboxs/mrboxs): actual TypeScript,
  React, TanStack, Void, Vite+, Tailwind CSS, Base UI, and Motion dependencies.
- [Brandkit](https://github.com/mrboxs/mrboxs-brandkit): symbol, wordmark,
  guidelines, and the existing versioned release link.
- [Isometric plugin source](/home/mrboxs/dev/work/figcraft-isometric/README.md)
  and the attached reference thread: top/left/right projection and extrusion.
- [Existing logo design](/home/mrboxs/dev/work/mrboxs/design/mrboxs-isometric/README.md):
  normal and pressed geometry. Original source contours are retained.

The hero's prose is proposed portfolio copy, not a quotation from the owner.
The Isometric project is described as local; no public repository is invented.
