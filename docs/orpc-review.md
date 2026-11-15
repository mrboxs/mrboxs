# oRPC setup review

Reviewed on 2026-11-15. The contract-first structure, `publicProcedures`, the
`getBySlug` procedure name, and the existing Octokit/cache service are preserved.

## Findings fixed

1. **Router context was incomplete.** `__root.tsx` required `orpc`, but
   `getContext()` returned only `queryClient`. The original check failed with
   TS2741. Context now includes the existing oRPC utils, with a separate
   QueryClient for each router/request.
2. **Browser requests could use the wrong host.** The link used
   `VITE_APP_URL`, whose default was localhost. The browser link now uses the
   current origin; SSR still invokes the server router directly. No Worker
   secrets or GitHub service code are included in the browser client.
3. **A cache hint could choose a read HTTP method for a mutation.** Method
   selection now prioritizes TanStack Query's operation context. Query
   operations use `QUERY`; mutations use `POST`. The name-based fallback remains
   for direct client calls, and `context.cache` controls fetch caching only.
   The custom client context is included in the exported client type.
4. **The reference described authentication and an origin that did not match
   this API.** Public blog procedures no longer inherit a blanket bearer-token
   requirement. The OpenAPI server URL is relative to the current host, including
   preview deployments. The reusable bearer security scheme remains available.

The handler module is explicitly server-only and loaded within server routes.
RPC and REST responses use `Cache-Control: no-store`, including failures, so HTTP
caches do not add another lifetime on top of the server publication cache.

## Data-check pages

- `/blog`: public list, author, publication date, description, tags, and links.
- `/blog/<slug>`: article metadata and its original Markdown in a text element.
  Markdown/HTML is escaped by React, never compiled or injected as HTML. Cover
  paths are text; images and a Markdown renderer are intentionally deferred.
- Both pages load through `orpc.blog.*.queryOptions()` and TanStack Query, using
  the same key in loaders and `useSuspenseQuery`. SSR data is hydrated through the
  existing Router/Query integration. Browser query freshness is 30 seconds;
  publication freshness in the server cache remains ten minutes.
- Empty, pending, retryable error, and not-found states are implemented. Draft,
  missing, and invalid URL slugs receive a not-found page. Error text does not
  expose source paths, credentials, or upstream payloads. HTML responses also use
  `no-store`.

## Verification

- Regression tests exercise the configured RPC and REST handlers, RPC encoding,
  detailed input/compact output, public OpenAPI spec, same-origin browser calls,
  method selection, and Query cache isolation.
- Route tests cover list-to-detail navigation, cache reuse between loader and
  component, empty state, draft/missing/invalid slugs, retry, and raw HTML escaping.
- Live local requests using the configured application credential returned the
  public `markdown-showcase` post and its 35,720-byte body. The RPC + TanStack
  Query call worked, the REST response matched, and the SSR text matched the
  original body exactly. Draft and missing articles were hidden.
- Production build, format/lint/typecheck, all 237 tests, and browser bundle
  boundary checks passed. React Doctor's changed-source scan, including the new
  untracked pages, scored 100/100.
- A broader scan also included generated `.cloudflare` and `.output` files and
  reported seven warnings. Inspection found non-security random values for React
  property names, history keys, and audio noise, plus React SSR serialization
  that already applies its script-tag escaping replacer. These are false
  positives in generated output; no rules were disabled or source suppressed.
- Production deployment and external proxy support for the custom `QUERY` method
  have not been tested. No deployment, remote resource, or credential was changed.

References read through the oRPC MCP:

- [TanStack Query integration](https://orpc.dev/docs/integrations/tanstack-query)
- [TanStack Start adapter](https://orpc.dev/docs/adapters/tanstack-start)
- [RPC Link](https://orpc.dev/docs/rpc/link)
