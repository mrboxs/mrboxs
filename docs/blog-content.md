# Blog content service

`src/lib/blog.server.ts` exposes `listPosts(): Promise<Array<PostMetadata>>` and
`getPostBySlug(slug): Promise<BlogPost>`. Import these only from server code.
The `.server.ts` suffix and TanStack Start's `server-only` marker protect the
module from browser imports. A future loader must call it through a server
boundary; TanStack route loaders themselves also run in the browser.

`src/lib/blog.ts` contains browser-safe data types and `resolvePostAsset()`.
The service returns Markdown as text. It never compiles or executes Markdown,
MDX, HTML, code fences, or optional extensions. UI, oRPC, Query integration,
asset delivery, persistent caching, and webhooks are outside this service.

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
The schema key is optional while the blog is not integrated, allowing the rest
of the app to run/deploy without it. Blog calls fail with a configuration error
until a nonempty credential is supplied. It has no default or `VITE_` prefix.

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

## Asset integration still required

`assets` keys are paths relative to the article folder, such as `cover.png` or
`images/diagram.png`. A future Markdown renderer can call
`resolvePostAsset(post, './cover.png')` for image destinations, including those
from reference images. It accepts an optional leading `./`, verifies membership
in the post's inventory, and rejects traversal, absolute URLs/paths, backslashes,
percent encoding, query strings, fragments, and control characters. A missing
or unsupported reference returns `undefined`; the renderer must handle it.
The body itself is never rewritten or scanned with a Markdown regex.

Before images can display, implement a same-origin asset endpoint or publish
approved assets to storage. That integration must translate these references
into application URLs, fetch the fixed repository's blobs on the server, and
return bytes with an appropriate content type. It must enforce public-post
visibility for the chosen snapshot and validate/allowlist the requested asset
against that post, rather than accepting arbitrary repo paths or commit IDs.
Do not redirect to GitHub, serialize GitHub `download_url` values, or send the
token to the browser. Raw GitHub URLs cannot serve this private repository to
anonymous readers. No asset HTTP endpoint or storage upload is included here.

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
