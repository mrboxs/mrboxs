# SEO and social previews

URLs use the typed environment variables declared in `env.ts`: `APP_URL` on the server and `VITE_APP_URL` in browser code. The production default for both is `https://mrboxs.isntboxs.workers.dev`. Override the variables for another environment; the application does not derive canonical URLs from the incoming request host.

Local `.env` configuration:

```ini
APP_URL=http://localhost:3000
VITE_APP_URL=http://localhost:3000
```

For production, `APP_URL` is a server runtime value, configurable with `vpx void secret put APP_URL=https://your-domain.example`. `VITE_APP_URL` is a public build-time value. Set the repository's Actions variable `VITE_APP_URL` for the deploy workflow, or supply it in the build shell. Void's deploy command deliberately ignores `.env` client values; a direct `vp build` follows Vite's normal `.env` loading. If neither variable is overridden during deployment, the schema's production defaults keep the current deployment working. The build task fingerprints `APP_URL` and `VITE_*` so changing a URL does not reuse an older environment's cached output.

For a local check of the production-domain build, supply matching values explicitly:

```sh
APP_URL=https://mrboxs.isntboxs.workers.dev VITE_APP_URL=https://mrboxs.isntboxs.workers.dev vp build
APP_URL=https://mrboxs.isntboxs.workers.dev VITE_APP_URL=https://mrboxs.isntboxs.workers.dev vp preview --port 3000 --strictPort
```

Both variables must identify the same public origin. The server rejects a mismatch so canonical URLs and JSON-LD cannot change after hydration. Server configuration is read inside the isomorphic server function at request time; the browser bundle contains only the client implementation. Canonical URLs, structured data, crawler documents, Markdown canonical headers, and OG image host labels use that configured origin. OG render cache keys include the origin.

Names and descriptions come from the existing profile, About section, projects, and published blog metadata. Placeholder contact details, the placeholder LinkedIn URL, and the placeholder employer are excluded from structured data.

## Pages and discovery

Home, the blog index, and article routes emit titles, descriptions, canonical URLs, robots directives, Open Graph metadata, and large Twitter cards through TanStack Start's route `head` API. JSON-LD describes the person, website, profile, blog, article, and breadcrumbs. Article publication dates and authors come from frontmatter; modification dates are omitted because the content source does not provide them. JSON-LD escapes script-breaking characters.

Unavailable routes have `noindex, follow` and no canonical link. Article pages advertise their Markdown alternate; Markdown responses point back to the HTML canonical with a `Link` header.

| Endpoint          | Content                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `/robots.txt`     | Public crawling rules and the absolute sitemap URL. Cover-image assets remain crawlable. |
| `/sitemap.xml`    | Home, the blog index, currently published posts, and their cover images.                 |
| `/llms.txt`       | Existing portfolio information, attributed article summaries, and Markdown links.        |
| `/llms-full.txt`  | Existing portfolio information and the full text of currently published articles.        |
| `/blog/{slug}.md` | The existing public Markdown version of an article.                                      |

Crawler documents read the same published-only content service as the application and send `Cache-Control: no-store`. Source failures return an error response rather than a successful empty sitemap. GET and HEAD are supported; other methods return 405.

## Open Graph images

| Endpoint              | Image                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `/og/default.png`     | MrBoxs, the existing profile description, the brand symbol, and the existing isometric artwork.   |
| `/og/blog/{slug}.png` | The published article's title, description, publication date, and author, with the same branding. |

Both return 1200×630 PNGs in the requested dark theme. Article metadata appends the current content revision as `?v={commit}` so sharing a revised post uses a new image URL. This parameter cannot select an old or private revision: the endpoint always reads the currently public article.

Rendering uses `@vercel/og` 0.11.1. `scripts/vercel-og.ts` loads its edge entry with compiled Yoga/resvg WASM modules and a local Geist font Data module, avoiding file/network font loading at Worker initialization. The renderer is imported only from server routes. The existing 500 kB JavaScript chunk budget remains enforced.

A bounded in-memory cache retains up to 16 renders for 60 seconds and combines simultaneous identical requests. Publication is checked before every cache lookup, including HEAD. At most two different images render concurrently. Errors are not cached, and HTTP responses use `no-store`, allowing an unpublish or deletion to take effect through the existing content service.

Render settlement and failure eviction are registered with Workers `waitUntil`, keeping capacity cleanup attached to the request lifetime even if its client disconnects. The handler still awaits the image before returning PNG bytes.

The artwork follows the existing monochrome portfolio: ENERGY 2 / RHYTHM 2 / MOTION 1, static typography with a single isometric identity motif. The name or article title is the focal point; secondary gray text and frame lines support hierarchy. Assets and font provenance are recorded in `src/assets/og/README.md`.

## Favicons

The adaptive SVG follows the browser color preference before hydration. `ThemeFavicon` then follows the app's resolved theme, including a saved manual selection, and updates the browser theme color. The supplied brandkit also provides the ICO fallback, Apple touch icon, regular icons, and maskable icon used by `manifest.json`.

## Validation

Run `vp check`, `vp test`, `vp run typecheck`, and `vp build`. Run the changed-code React Doctor scan with `vp run doctor --scope changed --base HEAD --include-untracked`.

Tests cover metadata, JSON-LD escaping, published-only crawler responses, HTTP methods and failures, publication checks on cached OG images, PNG dimensions and visible logo pixels, long titles, and light/dark favicon changes. URL configuration tests verify request-time server reads, browser-only public configuration, normalization, and rejection of mismatched origins. HTTP checks against the local Worker verify rendered page heads, 404/noindex behavior, public text endpoints, image responses, HEAD, and all public brand assets.

## Delivery gate

- Hard gate PASS: the supplied brand assets and existing copy are used; long text is bounded; actual PNGs were inspected with both symbols visible. No interactive controls were added. Theme-state tests verify both favicon variants.
- Purpose gate PASS: monochrome color, frame lines, restrained typography, and the isometric motif follow the written portfolio direction and support the title hierarchy.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1, a clear name/article-title focal point, structural spacing, and the existing isometric mark as the single graphic accent are present in both inspected previews.
- Craftsmanship PASS: 445 tests pass; format, lint, and type checks pass; React Doctor reports 100/100 with no diagnostics. Production Worker HTTP checks pass for page metadata, crawler documents, PNGs, visible logo pixels, and missing-article 404/noindex behavior. Regression tests cover short-viewport TOC sizing and OG render cleanup after client disconnection. The largest JavaScript chunks are 251,014 bytes in the browser and 411,194 bytes in the Worker, below the enforced 500,000-byte budget.
