# Blog Markdown renderer review

Reviewed on 2026-11-16 against the staged renderer and the
[AltStack renderer](https://github.com/isntboxs/altstack/tree/main/apps/web/src/components/public-content)
and [server preparation](https://github.com/isntboxs/altstack/blob/main/apps/web/src/features/public-content/prepare.server.ts).
Scope: Markdown rendering and its blog data integration. Page layout, branding,
and project/collection mention features are outside this change.

## Findings fixed

1. **High: the renderer was not connected to the blog.** The detail page displayed
   the entire body inside a plain `<pre>`. It now passes the body, slug, assets,
   and prepared tokens into `MarkdownRenderer`. The content wrapper is a section
   within the page's article, so it does not introduce a nested article.
2. **High: syntax highlighting had no preparation path.** The component accepted
   prepared tokens, but nothing generated or delivered them. The existing oRPC
   detail handler now prepares code after obtaining a public article and returns
   `prepared.codeBlocks`, validated by its output schema. Code blocks are keyed
   by Markdown source offsets. Both theme palettes arrive through SSR/Query;
   Shiki and its grammars stay on the server. Preparation is dynamically imported
   to keep server chunks within the project's 500 kB budget.
3. **High: post-relative images requested nonexistent page URLs.** Inline and
   reference images now resolve through the current post's asset inventory and
   public asset endpoint. Linked images use the same mapping and ordinary
   document navigation, rather than being intercepted as a UI route. Renderer
   URLs are decoded once before the existing strict path/membership checks,
   supporting spaces and Unicode without accepting encoded traversal. Missing
   and failed images display their alt text, including failures before hydration.
4. **Medium: relative links resolved from the old project URL shape.** They now
   resolve from `/blog/<slug>` against the router's request origin. Query strings
   and hashes survive internal navigation; external web links retain new-tab
   protection and an accessible announcement. The renderer no longer needs
   `VITE_APP_URL`. Its internal favicon now imports the actual brand asset,
   replacing a nonexistent `/favicon.svg`.
5. **Medium: heading IDs depended on every preceding heading.** Inserting an
   unrelated heading changed existing permalinks; a normal `#setup` link could
   not target `setup-0`. IDs now use the readable slug and suffix only collisions.
   The outline and rendered IDs share one implementation. Heading permalinks
   explicitly target the blog route, preserve search, move focus, respect reduced
   motion, and avoid nesting anchors around authored heading links. Image alt
   text is included in the permalink's accessible label.
6. **Medium: custom links discarded GFM footnote attributes.** Anchor IDs,
   accessible labels, and reference/backlink attributes are now forwarded.
   Footnote return links resolve to real elements.
7. **Medium: parent renders remounted content controls.** Inline renderer
   functions were recreated on every render, resetting wrap/copy state and image
   failure fallbacks. Their component map is memoized with stable defaults.
   Changed code is keyed by its source, and stale preparation cannot replace the
   current Markdown text. Out-of-order clipboard completions and completions
   after unmount cannot replace newer feedback or start a cleanup timer.
8. **Low: dependency and keyboard gaps.** `remark-parse` is now a direct
   dependency. The obsolete runtime `hast` and `mdast` packages were removed;
   their modern `@types/*` packages remain. Wide tables have a named keyboard
   scroll region. The unused public-content query key was removed; preparation
   shares the existing blog query instead of introducing another request/cache.

## Contract and fallbacks

```tsx
<MarkdownRenderer
	slug={post.slug}
	content={post.body}
	assets={post.assets}
	prepared={post.prepared}
/>
```

`prepared` and `assets` are optional for isolated rendering. Missing preparation
uses plain code. The blog route always supplies both from the same response.
The source service and publication/asset cache rules remain intact.

- GFM includes tables, strikethrough, task lists, autolinks, and footnotes.
- Raw HTML and JSX are skipped. Code is rendered as React text/tokens, never
  executed or injected with `dangerouslySetInnerHTML`. React Markdown's default
  URL transform remains enabled.
- Unknown languages, omitted grammars (including C++), highlighting failures,
  and blocks exceeding the remaining 50,000-character per-article highlight
  budget stay readable as plain code. This budget limits tokenization; it does
  not truncate the body or copyable code.
- Code copying preserves Markdown code-node whitespace, including tabs and
  trailing blank lines. Markdown parsing normalizes line endings by design.
- Project and collection links remain ordinary authored links. There are no
  mention lookups, chips, hover cards, or mention-specific query keys.

## Verification

Regression coverage includes server tokenization, offset/whitespace fidelity,
fallbacks, actual oRPC response serialization, blog navigation and existing error
boundaries, GFM/XSS cases, footnotes, relative URLs, encoded asset paths, image
failures, heading links/focus/reduced motion, clipboard races, rerenders, and SSR
hydration with both token palettes.

Final result: format/lint/typecheck and production build passed; all 271 tests
passed (34 more than the baseline). React Doctor remained at 100/100. The 17
browser JavaScript chunks contained no Shiki/grammar markers, and all server
chunks passed the 500 kB limit. `git diff --check` was clean.

Validation commands:

```sh
vp run check
vp run typecheck
vp test
vp run build
vp run doctor --verbose --scope changed
```

The automated interaction and hydration tests use Happy DOM. A production build
validates bundling and the 500 kB chunk limit. Browser verification follows below;
there has been no production deployment or Worker CPU benchmark.

## Browser verification, 2026-11-16

Checked the real `/blog/markdown-showcase` article in the shared Chromium browser
at 320, 390, and 1280 CSS pixels, using both light and dark themes.

- All 161 code blocks matched the server-prepared source exactly, including the
  empty blocks. The fresh server HTML also contained all 161 blocks with no
  source mismatches. There were 75 highlighted blocks and 86 plain-text blocks;
  the latter include intentional plaintext examples and unsupported grammars.
- All four article images loaded from the public asset endpoint. Inline,
  reference, and linked images worked. All same-page anchor and footnote
  destinations existed, with no duplicate IDs or nested links.
- Both tables retained their content and alignment. All 22 task checkboxes stayed
  disabled as authored article content. Nested lists, blockquotes, inline code,
  strikethrough, headings, and separators were visually checked.
- Real clipboard writes succeeded for normal, long, and empty code, including
  keyboard activation. Word wrap changed a long block from horizontal scrolling
  to wrapped text. The wide table could scroll using ArrowRight while focused.
- Heading permalinks updated the hash and focus. Repeated heading IDs remained
  distinct. Footnote references and return links worked. Theme switching changed
  token colors immediately without fetching a different highlighted version.
- No page-level horizontal overflow appeared at the tested widths. No application
  error or unhandled rejection was observed during the interactions. The browser
  log included 404 responses from Google's favicon service for fixture domains;
  these remove only the decorative favicon. The draft article returned the
  expected 404 page. These are not failed article-image requests.

Three browser findings were fixed and rechecked:

1. The inherited `wrap-anywhere` made a six-column table shrink and split words
   into individual letters on mobile. Tables now use normal word wrapping so
   intrinsic column widths produce scrolling inside the existing wrapper.
2. The black internal favicon disappeared against the dark background. Only the
   known internal brand asset is inverted in dark mode; external logo colors
   remain as supplied.
3. Native footnote backlinks scrolled their reference behind the fixed header.
   ID targets within the renderer now share the 96 px heading scroll margin.
   A browser check placed the returned reference below the 56 px header.

After these fixes, `vp run check`, all 271 tests, and `vp run build` passed.
React Doctor reported 100/100 for the two files changed relative to `HEAD`.
The broader `origin/main` comparison reported two existing warnings: intentional
sequential server tokenization and a JSON serialization round-trip assertion in
the tests. Neither was changed or suppressed in this browser pass.

Optional math, Mermaid diagrams, directives, and GitHub callouts remain literal
text/code/blockquote fallbacks. This is the fixture's stated fallback policy,
not evidence that those rich extensions are implemented.

## shadcn candidates (not installed)

These candidates were checked against the current official `@shadcn` Base UI
registry. The existing code controls already compose Button, Toggle, and Tooltip.

| Markdown/content | Candidate                                                             | Benefit and integration constraint                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables           | [Table](https://ui.shadcn.com/docs/components/base/table)             | Consistent cells, row hover, borders and scrolling. Preserve authored GFM alignment and allow long prose cells to wrap. A Data Table with sorting/filtering is unnecessary for ordinary article tables.                 |
| Fenced code      | [Code Block](https://ui.shadcn.com/docs/components/base/code-block)   | Composable header, title, actions, line numbers and highlighted/diff lines. Reuse the existing server tokens and robust copy feedback; the registry's client highlighting hook must not duplicate Shiki in the browser. |
| Article images   | [Dialog](https://ui.shadcn.com/docs/components/base/dialog)           | Click to open a larger image, with keyboard dismissal and focus management. Requires a named image-viewer wrapper; retain linked-image navigation. Dialog itself does not supply pan/zoom.                              |
| GitHub callouts  | [Alert](https://ui.shadcn.com/docs/components/base/alert)             | Give NOTE/TIP/IMPORTANT/WARNING/CAUTION distinct structure. Requires a Markdown AST transform to recognize markers; ordinary quotations should remain blockquotes.                                                      |
| Very long code   | [Collapsible](https://ui.shadcn.com/docs/components/base/collapsible) | An explicit expand/collapse control can shorten long excerpts. Optional behavior; copying must still use the entire source.                                                                                             |
| Horizontal rules | [Separator](https://ui.shadcn.com/docs/components/base/separator)     | Small consistency improvement using the already installed component. Preserve the non-decorative thematic-break semantics. This adds styling consistency, not interaction.                                              |

Task-list checkboxes should remain passive unless the product adds a separate
persistent task model. Swapping them for an interactive Checkbox alone would
misrepresent editable article content.
