# Blog content service

`src/lib/blog.server.ts` exposes `listPosts(): Promise<Array<PostMetadata>>` and
`getPostBySlug(slug): Promise<BlogPost>`. Import these only from server code.
The `.server.ts` suffix and TanStack Start's `server-only` marker protect the
module from browser imports. A future loader must call it through a server
boundary; TanStack route loaders themselves also run in the browser.

`src/lib/blog.ts` contains browser-safe data types, `resolvePostAsset()`, and
`getPostAssetUrl()`. `getPostAsset(slug, path)` reads public image bytes on the
server, exposed by `GET/HEAD /api/blog/assets/<slug>/<path>`.
The service returns Markdown as text. It never compiles or executes Markdown,
MDX, HTML, code fences, or optional extensions. UI, oRPC, Query integration,
storage uploads, and webhooks remain outside this service.

## Public Markdown

`GET/HEAD /blog/<slug>.md` reads through the same published-post service and
returns the title, description, and unchanged body as inline UTF-8 plain text.
`getPostMarkdown()` supplies identical content to Copy page and Download Markdown.
The response is `no-store`; drafts and missing posts return a generic 404,
and source failures return generic 500/502/503 responses without private details.
Only GET and HEAD are allowed. The page-options menu links AI services to this
public Markdown URL and GitHub to `posts/<slug>/index.md` in the private content
repository; GitHub access still requires the visitor's own permission.

## Repository contract

The trusted server constants are owner `mrboxs`, repository `written-by-boxs`,
and branch `main`. Callers cannot select another repository, ref, or file path.
The private repository's README is authoritative. The implementation was checked
against commit `2ed54926e6b7fa4a6c1517c7c9c1234688b14bf9` on 2026-11-15; it resolves
the current `main` on every operation using conditional GitHub requests rather
than fixing that reviewed commit. A retained snapshot is reused only after GitHub
confirms its ETag, so its storage TTL does not delay publication.

- Discover `posts/<slug>/index.md`; folder and frontmatter slug must match.
  Slugs and author IDs use lowercase letters/numbers separated by single hyphens.
- Require nonempty title/description, a valid calendar date string `YYYY-MM-DD`,
  a string array of tags, boolean `draft`, author ID, and cover `src`/`alt`.
- A public post's cover must resolve to a regular file with an image extension
  supported by the asset endpoint. Existing non-image files fail `cover.src`
  validation in both list and detail, without downloading the cover blob.
- Resolve authors from `authors/<id>.json`, requiring nonempty `name` and an
  HTTP(S) `url` without embedded credentials. Nonempty `bio` is optional.
- Parse only the leading YAML block through its closing `---` line. YAML aliases,
  duplicate keys, malformed YAML, and unsupported tags fail validation. The
  remaining body is preserved, including CRLF, whitespace, fenced `---`, and GFM.
- Filter drafts from list and direct detail. Lists contain metadata without body,
  draft flags, or asset inventories, sorted by date descending, then slug.
- Reject symlinks for articles/authors and omit them from the asset inventory.
  Invalid public content fails the operation rather than silently disappearing.
  Frontmatter is validated before a draft is filtered; draft authors/assets are
  not read or resolved.

On a cold cache, each operation reads the branch commit, then a recursive tree
by its tree SHA.
Markdown and author blobs are read by SHA from that tree, so branch changes
during a call cannot mix versions. Blob/author promises are deduplicated only
within that operation. There are two cold discovery requests, followed by required
Markdown blobs and distinct author blobs; no per-folder discovery or image
downloads. Detail reads only the requested article and its author. Truncated or
malformed trees fail explicitly instead of producing partial lists or false 404s.
The recursive-tree API suits this personal blog; a repository large enough to
truncate it will need a different discovery strategy.

## Server credential

The service requires `GITHUB_BLOG_TOKEN`, declared as a server key in root
`env.ts` and read through `env` from `void/env` when a function is called.
The schema key remains optional to allow unrelated app features to run/deploy
without it. Blog calls require a nonempty credential; the asset endpoint returns
a sanitized 500 response if it is missing. It has no default or `VITE_` prefix.

Use a separate fine-grained GitHub token restricted to **written-by-boxs** with
**Contents: read-only** permission. Configure rotation/expiry for production.
The local `gh` login is only suitable for an explicit read-only verification;
the application never invokes `gh` or treats that session as a production token.

For development, put `GITHUB_BLOG_TOKEN=<repository read token>` in the ignored
root `.env` file. Void uses this file, not `.env.local` or `.dev.vars`.
Do not commit the value. For the configured production target, set it through
Void's masked prompt:

```sh
vpx void secret put GITHUB_BLOG_TOKEN
```

This stores a Worker secret; `.env` values are not uploaded by deployment.
No production secret was set by this implementation. Each GitHub request has a
10-second abort signal. Octokit failures are replaced with sanitized errors:
the original request, authorization headers, response payload, and cause are
not retained or returned.

## Results and errors

`PostMetadata` includes `title`, `slug`, `description`, `publishedAt`, `tags`,
resolved `author: { id, name, url, bio? }`, and `cover: { src, alt }`.
`BlogPost` adds `body` and an `assets` dictionary. `cover.src` and dictionary
values are `BlogAsset` objects, **not fetchable URLs**:

```ts
{
	commit: '2ed54926e6b7fa4a6c1517c7c9c1234688b14bf9',
	path: 'posts/markdown-showcase/cover.png',
}
```

| Error                     | Meaning                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| `PostNotFoundError`       | Invalid/missing slug or draft; `code: POST_NOT_FOUND`                 |
| `InvalidBlogContentError` | Invalid content; contains `path` and `field`                          |
| `BlogSourceError`         | Source/config failure; contains `kind` and HTTP status when available |

`BlogSourceError.kind` is `configuration`, `access`, `rate-limit`, `network`,
`upstream`, or `invalid-response`. A GitHub 404 is an **access** failure: private
repository denial, missing branch, or an unavailable snapshot blob must not be
reported as a missing article. Only a complete successful tree lookup can
establish that an article does not exist. Draft and missing article errors have
the same message. Future HTTP adapters should map only `PostNotFoundError` to an
article 404 and use suitable server-error responses for the other classes.

## Asset endpoint

`assets` keys are paths relative to the article folder, such as `cover.png` or
`images/diagram.png`. The Markdown renderer calls
`resolvePostAsset(post, './cover.png')` for image destinations, including those
from reference images. It accepts an optional leading `./`, verifies membership
in the post's inventory, and rejects traversal, absolute URLs/paths, backslashes,
percent encoding, query strings, fragments, and control characters. A missing
or unsupported reference returns `undefined`; the renderer must handle it.
The body itself is never rewritten or scanned with a Markdown regex. Convert a
resolved reference (or `post.cover.src`) using `getPostAssetUrl(asset)`:

```ts
getPostAssetUrl(post.cover.src)
// /api/blog/assets/markdown-showcase/cover.png
```

The endpoint revalidates `main` with GitHub on every request and serves only assets
in a validated public post's current inventory. It takes no repository, branch,
token, or arbitrary commit input. Publishing, edits, deletions, asset removal,
and public-to-draft changes are picked up on the next source check, without
waiting for a cache TTL. An older page may load a newer version of an image.
All reads within one request stay pinned to its accepted snapshot; an in-flight
request is not retroactively revoked by a later push.

Supported image extensions are PNG, JPG/JPEG, GIF, WebP, AVIF, and SVG, with a
5 MiB limit per blob (also applied to Markdown/author reads). Other file types,
including Markdown, JSON, and HTML, are not served. The endpoint returns binary
bytes with an explicit image content type, content length, `nosniff`, and a
same-origin resource policy. SVG document navigation is isolated by a CSP
sandbox with scripts and external resources blocked. HEAD has the same status
and headers as GET but no body; it currently downloads the blob to determine the
exact byte length on a cold cache; a warm HEAD uses the same cached bytes as GET.
There is no redirect to GitHub or private download URL.

The blog renderer and its server preparation are described in
[markdown-renderer-review.md](./markdown-renderer-review.md). The oRPC detail
response adds a `prepared` field for code tokens; this source service continues
returning an untouched `BlogPost`. Rendering never bypasses the asset endpoint's
publication checks.

Responses use `Cache-Control: no-store`, including failures. The internal cache
does not change browser/CDN response caching, add ETags, conditional requests, or
range handling. A cold successful image request normally makes five GitHub reads:
commit, tree, article, author, and image blob; an entirely warm request makes none.

The endpoint returns 404 for invalid paths, unsupported files, missing assets,
symlinks, or unpublished/missing posts; 413 for oversized blobs; 502 for GitHub
access/network/upstream failures; 503 for GitHub rate limits; and 500 for
configuration or invalid-content failures. Error bodies contain no upstream
payload, repo paths, or credentials. Non-GET/HEAD methods are unsupported.

## Server cache and publication policy

`src/lib/blog-cache.server.ts` uses the native Cloudflare Workers Cache API,
in a named cache `blog-content-v1`. It is shared between Worker requests in the
same data center, survives individual service instances, and is not an in-memory
module map. There is no new dependency, KV/R2/database binding, configuration,
account, or provisioned resource. Void supplies Workers types through `void/env`;
this uses the Workers runtime API directly. Void's ISR is for rendered HTML and
uses stale-while-revalidate, which does not fit this publication gate. `void/kv`
would add a resource binding unnecessarily here.

Records have schema version 1, their full identity, an absolute creation time,
and an absolute expiry. Keys begin `blog-content-v1/mrboxs/written-by-boxs/`:

| Record                                            | Identity                                   | Lifetime    |
| ------------------------------------------------- | ------------------------------------------ | ----------- |
| Snapshot and ETag, revalidated on every operation | `publication/main`                         | 600 seconds |
| Validated frontmatter and untouched Markdown body | `post/<commit>/<slug>/<Markdown blob SHA>` | 24 hours    |
| Validated author data                             | `author/<blob SHA>`                        | 24 hours    |
| Image bytes encoded as base64                     | `image/<blob SHA>`                         | 24 hours    |

The mutable record contains the validated commit, complete nontruncated recursive
tree, and an optional validated ETag. Every operation sends an authenticated
conditional request for `main`; only a 304 with a valid prior snapshot can reuse
the commit. A 200 validates the returned commit and fetches its tree if the tree
SHA changed. Unchanged trees and blobs remain reusable. The ten-minute TTL is
record retention, never a freshness window that bypasses GitHub.
All other reads use identities from that exact tree.
Only parsed, valid frontmatter is stored; public articles also pass cover and
author validation before their content is stored. Valid draft frontmatter/body
can be cached internally to avoid repeated draft reads, but are never returned
publicly. Each public read resolves the cover, author, and asset inventory against
the accepted tree, including regular-file/symlink checks. Cached image bytes are
looked up **only after** that public-post and asset-membership gate. Historical
bytes, a previous commit in a `BlogAsset`, and arbitrary caller paths cannot
authorize an image. The immutable TTL never extends publication validity.

Expiry is checked in the application even if the backend returns an expired
record. Immutable reads do not extend their TTL. A successful publication
revalidation can refresh its retained record, but every subsequent use still
requires another GitHub check. Upstream/config/rate-limit/invalid-content errors
remain errors even with an unexpired record: there is no stale-if-error behavior
and no source error is converted to article/asset not-found. Successful tree
lookups alone establish missing paths; valid draft metadata establishes draft
status. Failures and negative lookup results are not stored as content/errors.

Cache failures, absent Cache API support, evictions, malformed JSON, incompatible
schemas, wrong identities, invalid lifetimes, future timestamps, and expired
records are optimization misses. Reads then use GitHub normally; a failed write
does not discard a successful, validated upstream result. Neither cache errors
nor upstream error objects are stored or logged. Credentials are still required
at call time **before cache access**. Tokens are never part of keys, values, or
synthetic cache requests; no Octokit request/response objects or private download
URLs are stored. Cache-only URLs under `https://blog-cache.internal/` are keys,
never fetched or exposed as public routes. Internal `max-age` headers never reach
asset HTTP responses.

Each serialized record is limited to 8 MiB, including base64/JSON overhead.
Oversized records skip writes, and cache reads stop after that limit. Images
retain the 5 MiB decoded limit on both upstream and cached data; tree sizes are
checked before blob-cache access. Markdown/author source reads retain their
5 MiB blob limit. Storage is bounded by per-record size, finite TTLs, and platform
eviction, rather than an app-managed unbounded map. There is no fixed aggregate
reservation or permanent archive; all keys derive from the trusted repository's
accepted snapshots, not arbitrary requests.

The [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
is local to a data center, not globally replicated or strongly consistent.
Each data center must revalidate its snapshot against GitHub before serving it;
cache locality therefore does not create a ten-minute publication lag. Cold
locations and evictions add GitHub reads. Concurrent cold requests may each
fill the cache. Only operation-local blob/author promises are deduplicated;
there are no cross-request I/O promises, global locks, or background refreshes
that could cross Workers execution contexts. Cache writes are awaited. Cache
API availability also depends on the deployment context (for example, dashboard
previews and Workers fronted by Cloudflare Access do not provide effective cache
operations). Those environments fall back to GitHub; Node tests mock the backend.
This implementation was not deployed and does not claim measured production hits.

`createBlogContentService(client, { cache, now })` opts tests into an explicit
store and clock. An injected client defaults to uncached operation and never
implicitly shares the configured application's cache. Separate stores remain
isolated; explicitly reusing a store opts into sharing validated entries.

## Automatic browser updates

`QUERY /api/reference/blog-revision` returns only the currently validated commit
SHA as `{ revision }`. It does not load article blobs or prepare Markdown.
The existing RPC transport exposes the same procedure as `blog.revision`.

`useBlogUpdates()` checks that revision every five seconds while a blog page is
active. Its initial baseline comes from the loaded post cover's snapshot commit,
so a push between SSR and the first check is also detected. An empty list has no
baseline and is reconciled on its first successful check. Unchanged revisions
do not refetch article data or run Markdown preparation.

A changed revision invalidates the list and detail Query caches, refreshes the
active route loader and its head metadata, and updates neighboring-post links.
An article that becomes a draft or is deleted goes through the existing 404
boundary. Polling stops when the blog page unmounts, pauses in hidden tabs, and
checks again on focus/reconnect. Revision-check failures preserve the readable
page and back off to a 60-second interval; the regular route error boundaries
still handle actual content read failures.

This is automatic polling, not a webhook or server-push subscription. Detection
normally takes the next five-second interval plus network and rendering time,
and works in localhost as well as production without a publicly reachable
webhook endpoint or new credentials/resources. GitHub's
[conditional-request guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests)
states that authenticated 304 responses do not consume the primary rate limit;
network requests and secondary limits still apply.

## Validation

```sh
vp install
vp run verify
```

`tests/lib/blog.test.ts` uses real Octokit with mocked HTTP responses and no
GitHub credentials or network dependency. It covers public/draft visibility,
metadata and author validation, unsafe paths, body preservation, snapshot
consistency, deduplicated discovery, error classification/redaction, and the
call-time Void credential boundary. It also uses mock clocks, mock cache stores,
and a mocked Workers Cache API with real Response serialization to cover warm
read counts, ETag/304 revalidation, immutable snapshot consistency, exact TTL
expiration, publishing, edits, draft/deletion/asset revocation without waiting
for expiry, retained historical bytes, failed and malformed cache records,
upstream failures with warm caches, storage/decoded size bounds, independent
clients/stores, and cached GET/HEAD security headers. Route tests use simulated
pushes and fake timers to cover automatic list/detail/metadata/navigation refresh,
withdrawn articles, initial-load races, backoff, and polling cleanup.

Read-only verification against the actual private repo at the reviewed commit
returned only `markdown-showcase`, resolved `mrboxs`, and preserved all 35,720
UTF-8 body bytes. Direct `markdown-draft` and a missing slug both produced
`PostNotFoundError`. The local CLI credential was held in memory for that check,
without being saved as application configuration or a production secret.
