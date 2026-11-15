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

DOM interactions and hydration use Happy DOM. A production build validates
bundling and the 500 kB chunk limit. This review does not claim browser visual
verification, a production deployment, or measured Worker CPU performance.
