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
persistent caching, storage uploads, and webhooks remain outside this service.

## Repository contract

The trusted server constants are owner `mrboxs`, repository `written-by-boxs`,
and branch `main`. Callers cannot select another repository, ref, or file path.
The private repository's README is authoritative. The implementation was checked
against commit `2ed54926e6b7fa4a6c1517c7c9c1234688b14bf9` on 2026-11-15; it resolves
the current `main` on every operation rather than fixing that reviewed commit.

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

Each operation reads the branch commit, then a recursive tree by its tree SHA.
Markdown and author blobs are read by SHA from that tree, so branch changes
during a call cannot mix versions. Blob/author promises are deduplicated only
within that operation. There are two discovery requests, followed by required
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
`images/diagram.png`. A future Markdown renderer can call
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

The endpoint checks the current `main` snapshot on every request and serves
only assets in a validated public post's inventory. It takes no repository,
branch, token, or arbitrary commit input. References retain their commit for
future snapshot-aware integrations, but the generated URL intentionally uses
current publication state: an article becoming a draft/deleted immediately
closes access on the next request. An older page may therefore load the newer
version of an image. All reads within an individual request use one snapshot.

Supported image extensions are PNG, JPG/JPEG, GIF, WebP, AVIF, and SVG, with a
5 MiB limit per blob (also applied to Markdown/author reads). Other file types,
including Markdown, JSON, and HTML, are not served. The endpoint returns binary
bytes with an explicit image content type, content length, `nosniff`, and a
same-origin resource policy. SVG document navigation is isolated by a CSP
sandbox with scripts and external resources blocked. HEAD has the same status
and headers as GET but no body; it currently downloads the blob to determine the
exact byte length. There is no redirect to GitHub or private download URL.

Responses use `Cache-Control: no-store`, including failures. No persistent
server cache, CDN cache, ETag, conditional request, or range handling is added
yet. Each successful request normally makes five GitHub reads: commit, tree,
article, author, and image blob. Caching can be added later with an explicit
publication/revocation policy.

The endpoint returns 404 for invalid paths, unsupported files, missing assets,
symlinks, or unpublished/missing posts; 413 for oversized blobs; 502 for GitHub
access/network/upstream failures; 503 for GitHub rate limits; and 500 for
configuration or invalid-content failures. Error bodies contain no upstream
payload, repo paths, or credentials. Non-GET/HEAD methods are unsupported.

## Validation

```sh
vp install
vp run types
vp check
vp test
vp run build
```

`tests/lib/blog.test.ts` uses real Octokit with mocked HTTP responses and no
GitHub credentials or network dependency. It covers public/draft visibility,
metadata and author validation, unsafe paths, body preservation, snapshot
consistency, deduplicated discovery, error classification/redaction, and the
call-time Void credential boundary.

Read-only verification against the actual private repo at the reviewed commit
returned only `markdown-showcase`, resolved `mrboxs`, and preserved all 35,720
UTF-8 body bytes. Direct `markdown-draft` and a missing slug both produced
`PostNotFoundError`. The local CLI credential was held in memory for that check,
without being saved as application configuration or a production secret.
