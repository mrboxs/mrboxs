import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { Octokit } from '@octokit/rest'

import { getPostAssetUrl, resolvePostAsset } from '#/lib/blog'
import { handleBlogAssetRequest } from '#/lib/blog-assets.server'
import {
	BlogSourceError,
	createBlogContentService,
	getPostBySlug,
	InvalidBlogContentError,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'

const configuration = vi.hoisted(() => ({
	token: undefined as string | undefined,
}))
vi.mock('void/env', () => ({
	env: {
		get GITHUB_BLOG_TOKEN() {
			return configuration.token
		},
	},
}))

const commit = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)
const nextCommit = 'c'.repeat(40)
const body = [
	'',
	'# Judul 📝',
	'',
	'```yaml',
	'---',
	'title: not frontmatter',
	'---',
	'```',
	'',
	'| GFM | Tabel |',
	'| --- | --- |',
	'| satu | dua |',
	'',
	'![Cover](./cover.png)',
	'',
	'import X from "./example.mdx"',
	'<script>throw new Error("never execute")</script>',
	'',
].join('\n')

function article(slug: string, overrides: Record<string, unknown> = {}) {
	// JSON is valid YAML; the dedicated YAML tests exercise non-JSON frontmatter.
	return `---\n${JSON.stringify({
		title: `Post ${slug}`,
		slug,
		description: 'Deskripsi artikel.',
		publishedAt: '2026-11-15',
		tags: ['markdown', 'blog'],
		draft: false,
		author: 'mrboxs',
		cover: { src: './cover.png', alt: 'Banner artikel.' },
		...overrides,
	})}\n---\n${body}`
}

interface FixtureFile {
	path: string
	source: string
	mode?: string
	bytes?: Array<number>
	size?: number
}

function fixture() {
	const files: Array<FixtureFile> = [
		{ path: 'posts/newer/index.md', source: article('newer') },
		{
			path: 'posts/older/index.md',
			source: article('older', { publishedAt: '2024-02-29' }),
		},
		{
			path: 'posts/draft/index.md',
			source: article('draft', { draft: true }),
		},
		{
			path: 'authors/mrboxs.json',
			source: JSON.stringify({
				name: 'MrBoxs',
				url: 'https://github.com/mrboxs',
				bio: 'Penulis blog.',
			}),
		},
		...['newer', 'older', 'draft'].map((slug) => ({
			path: `posts/${slug}/cover.png`,
			source: 'binary is never downloaded',
		})),
		{
			path: 'posts/newer/images/diagram.png',
			source: 'another asset',
		},
	]
	const failures = new Map<
		string,
		{ status: number; message: string; headers?: Record<string, string> }
	>()
	let truncated = false
	let head = commit
	const fetch = vi.fn<typeof globalThis.fetch>((input) =>
		Promise.resolve().then(() => {
			const url = new URL(
				input instanceof Request ? input.url : input.toString()
			)
			const suffix = url.pathname.replace('/repos/mrboxs/written-by-boxs/', '')
			const failure = failures.get(suffix)
			if (failure) {
				return Response.json(
					{ message: failure.message },
					{ status: failure.status, headers: failure.headers }
				)
			}
			if (suffix === 'commits/main') {
				return Response.json({ sha: head, commit: { tree: { sha: treeSha } } })
			}
			if (suffix === `git/trees/${treeSha}`) {
				expect(url.searchParams.get('recursive')).toBe('1')
				return Response.json({
					truncated,
					tree: files.map((file, index) => ({
						path: file.path,
						mode: file.mode ?? '100644',
						type: 'blob',
						sha: (index + 1).toString(16).padStart(40, '0'),
						size: file.size,
					})),
				})
			}
			const blob = /^git\/blobs\/([a-f0-9]{40})$/.exec(suffix)
			const file = blob ? files[Number.parseInt(blob[1], 16) - 1] : undefined
			if (file) {
				return Response.json({
					encoding: 'base64',
					content: btoa(
						Array.from(
							file.bytes ?? new TextEncoder().encode(file.source),
							(byte) => String.fromCharCode(byte)
						).join('')
					),
				})
			}
			throw new Error(`Unexpected GitHub request: ${url.pathname}`)
		})
	)
	const service = createBlogContentService(
		new Octokit({
			auth: 'test-only-token',
			request: { fetch },
			log: {
				debug: () => undefined,
				info: () => undefined,
				warn: () => undefined,
				error: () => undefined,
			},
		})
	)
	return {
		files,
		failures,
		fetch,
		service,
		setTruncated: () => (truncated = true),
		advanceHead: () => (head = nextCommit),
	}
}

afterEach(() => {
	configuration.token = undefined
	vi.unstubAllGlobals()
})

describe('blog content service', () => {
	it('lists only public metadata, newest first, with one discovery and author read', async () => {
		const { service, fetch } = fixture()
		const posts = await service.listPosts()
		expect(posts.map((post) => post.slug)).toEqual(['newer', 'older'])
		expect(posts[0]).toEqual({
			title: 'Post newer',
			slug: 'newer',
			description: 'Deskripsi artikel.',
			publishedAt: '2026-11-15',
			tags: ['markdown', 'blog'],
			author: {
				id: 'mrboxs',
				name: 'MrBoxs',
				url: 'https://github.com/mrboxs',
				bio: 'Penulis blog.',
			},
			cover: {
				src: { commit, path: 'posts/newer/cover.png' },
				alt: 'Banner artikel.',
			},
		})
		// Two discovery calls, three Markdown blobs, and one shared author blob.
		expect(fetch).toHaveBeenCalledTimes(6)
		expect(JSON.stringify(posts)).not.toMatch(
			/token|download_url|api.github.com/
		)
	})

	it('returns an empty list for a repository with no articles', async () => {
		const { service, files } = fixture()
		files.length = 0
		await expect(service.listPosts()).resolves.toEqual([])
	})

	it.each(['notes.txt', 'page.html', 'metadata.json', 'document.pdf'])(
		'rejects an existing non-image cover %s in detail and list',
		async (filename) => {
			const { service, files } = fixture()
			files[0].source = article('newer', {
				cover: { src: `./${filename}`, alt: 'Banner artikel.' },
			})
			files.push({ path: `posts/newer/${filename}`, source: 'not an image' })
			await expect(service.getPostBySlug('newer')).rejects.toMatchObject({
				name: 'InvalidBlogContentError',
				field: 'cover.src',
			})
			await expect(service.listPosts()).rejects.toBeInstanceOf(
				InvalidBlogContentError
			)
		}
	)

	it.each(['images/cover.JPG', 'cover.webp', 'cover.svg'])(
		'accepts a supported image cover %s without downloading it',
		async (filename) => {
			const { service, files, fetch } = fixture()
			files[0].source = article('newer', {
				cover: { src: `./${filename}`, alt: 'Banner artikel.' },
			})
			files.push({ path: `posts/newer/${filename}`, source: 'image bytes' })
			await expect(service.getPostBySlug('newer')).resolves.toMatchObject({
				cover: { src: { commit, path: `posts/newer/${filename}` } },
			})
			expect(fetch).toHaveBeenCalledTimes(4)
		}
	)

	it('preserves the entire Markdown body and resolves only post-local assets', async () => {
		const { service } = fixture()
		const post = await service.getPostBySlug('newer')
		expect(post.body).toBe(body)
		expect(resolvePostAsset(post, './cover.png')).toEqual(post.cover.src)
		expect(resolvePostAsset(post, 'images/diagram.png')).toEqual({
			commit,
			path: 'posts/newer/images/diagram.png',
		})
		expect(resolvePostAsset(post, './absent.png')).toBeUndefined()
		expect(resolvePostAsset(post, './index.md')).toBeUndefined()
	})

	it('parses YAML block scalars and preserves CRLF, fences, and trailing whitespace', async () => {
		const { service, files } = fixture()
		const crlfBody = `${body.replaceAll('\n', '\r\n')}  \r\n`
		files[0].source =
			[
				'\uFEFF---',
				'title: Judul YAML',
				'slug: newer',
				'description: >-',
				'  Ringkasan dua',
				'  baris.',
				'publishedAt: "2026-11-15"',
				'tags: [markdown]',
				'draft: false',
				'author: mrboxs',
				'cover:',
				'  src: ./cover.png',
				'  alt: Banner',
				'---',
				'',
			].join('\r\n') + crlfBody
		const post = await service.getPostBySlug('newer')
		expect(post.description).toBe('Ringkasan dua baris.')
		expect(post.body).toBe(crlfBody)
	})

	it.each(['draft', 'missing'])(
		'hides %s with the same not-found error',
		async (slug) => {
			const { service, fetch } = fixture()
			await expect(service.getPostBySlug(slug)).rejects.toMatchObject({
				name: 'PostNotFoundError',
				code: 'POST_NOT_FOUND',
				message: 'Post not found',
			})
			expect(fetch).toHaveBeenCalledTimes(slug === 'draft' ? 3 : 2)
		}
	)

	it.each([
		'',
		'../newer',
		'/newer',
		'newer/../../README.md',
		'Newer',
		'two--hyphens',
		'newer%2findex.md',
		'newer\\index.md',
		'newer?ref=other',
		'newer\n',
	])('rejects unsafe slug %j before any GitHub request', async (slug) => {
		const { service, fetch } = fixture()
		await expect(service.getPostBySlug(slug)).rejects.toBeInstanceOf(
			PostNotFoundError
		)
		expect(fetch).not.toHaveBeenCalled()
	})

	it.each([
		{ title: '' },
		{ description: null },
		{ slug: 'other-folder' },
		{ publishedAt: '2026-02-29' },
		{ publishedAt: '2026-02-30' },
		{ publishedAt: '2026-13-01' },
		{ publishedAt: '2026-1-01' },
		{ publishedAt: '2026-11-15T00:00:00Z' },
		{ publishedAt: 20261115 },
		{ tags: 'markdown' },
		{ tags: [42] },
		{ draft: 'false' },
		{ author: '../mrboxs' },
		{ author: 'mrboxs/other' },
		{ author: '%2e%2e' },
		{ author: 'mrboxs\\other' },
		{ cover: { src: '../draft/cover.png', alt: 'Banner' } },
		{ cover: { src: '/cover.png', alt: 'Banner' } },
		{ cover: { src: 'https://example.com/cover.png', alt: 'Banner' } },
		{ cover: { src: './cover.png', alt: '' } },
		{ cover: { src: './missing.png', alt: 'Banner' } },
	])('rejects malformed metadata %j in detail and list', async (overrides) => {
		const { service, files } = fixture()
		files[0].source = article('newer', overrides)
		await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(
			InvalidBlogContentError
		)
		await expect(service.listPosts()).rejects.toBeInstanceOf(
			InvalidBlogContentError
		)
	})

	it.each([
		'body without frontmatter\n---\ntitle: ignored\n---',
		'---\ntitle: no closing delimiter',
		'---\n[invalid YAML\n---\nbody',
		'---\ntitle: one\ntitle: two\n---\nbody',
		'---\ntitle: !!js/function function() {}\n---\nbody',
		'---\ntitle: &a [*a]\n---\nbody',
	])('rejects malformed or executable-style YAML %j', async (source) => {
		const { service, files } = fixture()
		files[0].source = source
		await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(
			InvalidBlogContentError
		)
	})

	it.each([
		'not JSON',
		'{}',
		'{"name":"","url":"https://example.com"}',
		'{"name":"MrBoxs","url":"javascript:alert(1)"}',
		'{"name":"MrBoxs","url":"https://user:password@example.com"}',
		'{"name":"MrBoxs","url":"https://example.com","bio":42}',
	])('rejects malformed author %j', async (source) => {
		const { service, files } = fixture()
		files[3].source = source
		await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(
			InvalidBlogContentError
		)
	})

	it('allows an author without a bio but rejects a missing author file', async () => {
		const { service, files } = fixture()
		files[3].source = '{"name":"MrBoxs","url":"https://github.com/mrboxs"}'
		expect((await service.getPostBySlug('newer')).author).not.toHaveProperty(
			'bio'
		)
		files.splice(3, 1)
		await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(
			InvalidBlogContentError
		)
	})

	it.each([0, 3, 4])(
		'rejects a symlink for post, author, or cover (%i)',
		async (index) => {
			const { service, files } = fixture()
			files[index].mode = '120000'
			await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(
				InvalidBlogContentError
			)
		}
	)

	it('rejects invalid article folders during discovery', async () => {
		const { service, files } = fixture()
		files[0].path = 'posts/Invalid-Slug/index.md'
		await expect(service.listPosts()).rejects.toBeInstanceOf(
			InvalidBlogContentError
		)
	})

	it('fails on truncated discovery instead of returning false not-found or partial lists', async () => {
		const { service, setTruncated } = fixture()
		setTruncated()
		await expect(service.listPosts()).rejects.toMatchObject({
			kind: 'invalid-response',
		})
		await expect(service.getPostBySlug('missing')).rejects.toBeInstanceOf(
			BlogSourceError
		)
	})

	it('rejects malformed GitHub discovery instead of inventing missing content', async () => {
		const { service, fetch } = fixture()
		fetch.mockResolvedValueOnce(Response.json({ sha: 'not-a-commit' }))
		await expect(service.getPostBySlug('missing')).rejects.toMatchObject({
			kind: 'invalid-response',
		})
	})

	it.each([
		{ encoding: 'utf-8', content: 'unexpected encoding' },
		{ encoding: 'base64', content: 'not valid base64!' },
		{ encoding: 'base64', content: '/w==' },
	])('rejects malformed blob or UTF-8 responses %j', async (blob) => {
		const { service, fetch } = fixture()
		const respond = fetch.getMockImplementation()!
		fetch.mockImplementation((url, options) =>
			(url instanceof Request ? url.url : url.toString()).includes(
				'/git/blobs/'
			)
				? Promise.resolve(Response.json(blob))
				: respond(url, options)
		)
		await expect(service.getPostBySlug('newer')).rejects.toMatchObject({
			kind: 'invalid-response',
		})
	})

	it('classifies a non-JSON HTTP failure without exposing the response', async () => {
		const { service, fetch } = fixture()
		fetch.mockResolvedValueOnce(
			new Response('test-only-token', { status: 503 })
		)
		const error: unknown = await service
			.listPosts()
			.catch((reason: unknown) => reason)
		expect(error).toMatchObject({ kind: 'upstream', status: 503 })
		expect(String(error)).not.toContain('test-only-token')
	})

	it('passes a separate abort signal to every GitHub request', async () => {
		const { service, fetch } = fixture()
		await service.getPostBySlug('newer')
		const signals = fetch.mock.calls.map(([, options]) => options?.signal)
		expect(signals).toHaveLength(4)
		expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
		expect(new Set(signals).size).toBe(signals.length)
	})

	it.each([
		{ status: 401, message: 'Bad credentials', kind: 'access' },
		{ status: 403, message: 'Forbidden', kind: 'access' },
		{ status: 404, message: 'Not Found', kind: 'access' },
		{ status: 429, message: 'Too Many Requests', kind: 'rate-limit' },
		{ status: 403, message: 'API rate limit exceeded', kind: 'rate-limit' },
		{ status: 403, message: 'Secondary rate limit', kind: 'rate-limit' },
		{ status: 503, message: 'Unavailable', kind: 'upstream' },
	])(
		'distinguishes HTTP $status/$kind failures from content not-found',
		async ({ kind, ...failure }) => {
			const { service, failures } = fixture()
			failures.set('commits/main', failure)
			await expect(service.getPostBySlug('missing')).rejects.toMatchObject({
				name: 'BlogSourceError',
				kind,
				status: failure.status,
			})
			await expect(service.listPosts()).rejects.toBeInstanceOf(BlogSourceError)
		}
	)

	it.each<Record<string, string>>([
		{ 'x-ratelimit-remaining': '0' },
		{ 'retry-after': '60' },
	])('recognizes rate-limit headers %j', async (headers) => {
		const { service, failures } = fixture()
		failures.set('commits/main', {
			status: 403,
			message: 'Forbidden',
			headers,
		})
		await expect(service.listPosts()).rejects.toMatchObject({
			kind: 'rate-limit',
		})
	})

	it.each([`git/trees/${treeSha}`, `git/blobs/${'1'.padStart(40, '0')}`])(
		'keeps upstream 404 at %s distinct from missing content',
		async (endpoint) => {
			const { service, failures } = fixture()
			failures.set(endpoint, { status: 404, message: 'Not Found' })
			await expect(service.getPostBySlug('newer')).rejects.toMatchObject({
				kind: 'access',
				status: 404,
			})
		}
	)

	it('sanitizes network errors without exposing the Octokit request or token', async () => {
		const { service, fetch } = fixture()
		fetch.mockRejectedValue(new TypeError('fetch failed with test-only-token'))
		const error: unknown = await service
			.listPosts()
			.catch((reason: unknown) => reason)
		expect(error).toBeInstanceOf(BlogSourceError)
		expect(error).toMatchObject({ kind: 'network' })
		expect(String(error)).not.toContain('test-only-token')
		expect(JSON.stringify(error)).not.toMatch(
			/test-only-token|authorization|request|cause/
		)
	})

	it('pins all reads to one snapshot and refreshes the snapshot on the next operation', async () => {
		const { service, advanceHead, fetch } = fixture()
		const originalFetch = fetch.getMockImplementation()
		fetch.mockImplementation(async (...args) => {
			const response = await originalFetch!(...args)
			advanceHead()
			return response
		})
		expect((await service.getPostBySlug('newer')).cover.src.commit).toBe(commit)
		expect((await service.getPostBySlug('newer')).cover.src.commit).toBe(
			nextCommit
		)
		expect(
			fetch.mock.calls.every(
				([url]) =>
					!(url instanceof Request ? url.url : url.toString()).includes(
						'/contents/'
					)
			)
		).toBe(true)
	})

	it('reads the Void secret at call time and requires it only for the blog service', async () => {
		await expect(listPosts()).rejects.toMatchObject({ kind: 'configuration' })
		const { fetch } = fixture()
		vi.stubGlobal('fetch', fetch)
		configuration.token = 'configured-test-token'
		await expect(getPostBySlug('newer')).resolves.toMatchObject({
			slug: 'newer',
		})
		expect(fetch.mock.calls[0][1]?.headers).toMatchObject({
			authorization: 'token configured-test-token',
		})
		configuration.token = ''
		await expect(listPosts()).rejects.toMatchObject({ kind: 'configuration' })
		await expect(getPostBySlug('../README.md')).rejects.toBeInstanceOf(
			PostNotFoundError
		)
	})
})

describe('resolvePostAsset', () => {
	it.each([
		'../other/cover.png',
		'/cover.png',
		'//example.com/cover.png',
		'https://example.com/cover.png',
		'data:image/png;base64,123',
		'images/../../cover.png',
		'./images/../cover.png',
		'images//cover.png',
		'%2e%2e/cover.png',
		'images%2fcover.png',
		'.\\cover.png',
		'cover.png?token=secret',
		'cover.png#anchor',
		'cover.png\u0000',
	])('rejects unsafe reference %j', (reference) => {
		const assets = { [reference]: { commit, path: 'must never resolve' } }
		expect(resolvePostAsset({ assets }, reference)).toBeUndefined()
	})
})

describe('blog asset HTTP endpoint', () => {
	function setup() {
		const result = fixture()
		configuration.token = 'asset-test-token'
		vi.stubGlobal('fetch', result.fetch)
		return result
	}
	function request(slug = 'newer', path = 'cover.png', method = 'GET') {
		return handleBlogAssetRequest(
			new Request(`https://example.com/api/blog/assets/${slug}/${path}`, {
				method,
			}),
			slug,
			path
		)
	}

	it('serves binary bytes with image headers and no GitHub credentials or redirect', async () => {
		const { files, fetch } = setup()
		const bytes = [137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]
		files[4].bytes = bytes
		const response = await request()
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('image/png')
		expect(response.headers.get('Content-Length')).toBe(String(bytes.length))
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
		expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe(
			'same-origin'
		)
		expect(response.headers.get('Location')).toBeNull()
		expect(JSON.stringify([...response.headers])).not.toMatch(/token|github/i)
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual(bytes)
		expect(fetch).toHaveBeenCalledTimes(5)
	})

	it('answers HEAD with the same headers and an empty body', async () => {
		setup()
		const response = await request('newer', 'cover.png', 'HEAD')
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('image/png')
		expect(Number(response.headers.get('Content-Length'))).toBeGreaterThan(0)
		expect(await response.text()).toBe('')
	})

	it('serves nested images and isolates SVG document navigation', async () => {
		const { files } = setup()
		expect((await request('newer', 'images/diagram.png')).status).toBe(200)
		files.push({
			path: 'posts/newer/banner.svg',
			source: '<svg><script>alert(1)</script></svg>',
		})
		const response = await request('newer', 'banner.svg')
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('image/svg+xml')
		expect(response.headers.get('Content-Security-Policy')).toContain('sandbox')
		expect(response.headers.get('Content-Security-Policy')).toContain(
			"default-src 'none'"
		)
	})

	it.each(['draft', 'missing'])(
		'hides assets of a %s article',
		async (slug) => {
			const { fetch } = setup()
			const response = await request(slug)
			expect(response.status).toBe(404)
			expect(await response.text()).toBe('Not found')
			expect(fetch).toHaveBeenCalledTimes(slug === 'draft' ? 3 : 2)
		}
	)

	it.each([
		'../draft/cover.png',
		'%2e%2e/cover.png',
		'images%2fcover.png',
		'/cover.png',
		'images/../cover.png',
		'cover.png?ref=main',
		'cover.png#anchor',
		'index.md',
		'authors/mrboxs.json',
		'page.html',
		'https://example.com/image.png',
		'image\\cover.png',
		'',
	])(
		'rejects unsafe or unsupported path %j before contacting GitHub',
		async (path) => {
			const { fetch } = setup()
			const response = await request('newer', path)
			expect(response.status).toBe(404)
			expect(fetch).not.toHaveBeenCalled()
		}
	)

	it('rejects invalid slugs before contacting GitHub', async () => {
		const { fetch } = setup()
		expect((await request('../draft')).status).toBe(404)
		expect(fetch).not.toHaveBeenCalled()
	})

	it.each(['missing.png', 'linked.png'])(
		'returns 404 for absent or symlink asset %s',
		async (path) => {
			const { files } = setup()
			files.push({
				path: 'posts/newer/linked.png',
				source: '../draft/cover.png',
				mode: '120000',
			})
			expect((await request('newer', path)).status).toBe(404)
		}
	)

	it('refuses oversized assets before downloading the blob', async () => {
		const { files, fetch } = setup()
		files[4].size = 5 * 1024 * 1024 + 1
		expect((await request()).status).toBe(413)
		expect(fetch).toHaveBeenCalledTimes(4)
	})

	it('rechecks publication when a previously public article becomes a draft', async () => {
		const { files } = setup()
		expect((await request()).status).toBe(200)
		files[0].source = article('newer', { draft: true })
		expect((await request()).status).toBe(404)
	})

	it.each([
		{ status: 404, expected: 502, message: 'Repository inaccessible' },
		{ status: 401, expected: 502, message: 'asset-test-token' },
		{ status: 403, expected: 503, message: 'Rate limit exceeded' },
		{ status: 503, expected: 502, message: 'Unavailable' },
	])(
		'maps upstream $status to $expected without leaking GitHub data',
		async ({ expected, ...failure }) => {
			const { failures } = setup()
			failures.set('commits/main', failure)
			const response = await request()
			expect(response.status).toBe(expected)
			expect(await response.text()).toBe('Asset temporarily unavailable')
			expect(response.headers.get('Cache-Control')).toBe('no-store')
		}
	)

	it('returns sanitized errors for network, malformed content, and missing config', async () => {
		const { fetch, files } = setup()
		fetch.mockRejectedValueOnce(new TypeError('asset-test-token'))
		expect((await request()).status).toBe(502)
		files[0].source = 'malformed article'
		const response = await request()
		expect(response.status).toBe(500)
		expect(await response.text()).toBe('Asset temporarily unavailable')
		configuration.token = undefined
		expect((await request()).status).toBe(500)
	})

	it('keeps HEAD errors bodyless and rejects unsupported methods', async () => {
		const { fetch } = setup()
		const head = await request('draft', 'cover.png', 'HEAD')
		expect(head.status).toBe(404)
		expect(await head.text()).toBe('')
		fetch.mockClear()
		const post = await request('newer', 'cover.png', 'POST')
		expect(post.status).toBe(405)
		expect(post.headers.get('Allow')).toBe('GET, HEAD')
		expect(fetch).not.toHaveBeenCalled()
	})

	it('builds an encoded same-origin URL from a post asset reference', () => {
		expect(getPostAssetUrl({ commit, path: 'posts/newer/cover.png' })).toBe(
			'/api/blog/assets/newer/cover.png'
		)
		expect(
			getPostAssetUrl({ commit, path: 'posts/newer/images/my cover.png' })
		).toBe('/api/blog/assets/newer/images/my%20cover.png')
		expect(
			getPostAssetUrl({ commit, path: 'authors/mrboxs.json' })
		).toBeUndefined()
		expect(
			getPostAssetUrl({ commit, path: 'posts/newer/../draft/cover.png' })
		).toBeUndefined()
	})
})
