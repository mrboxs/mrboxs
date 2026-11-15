import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createHash } from 'node:crypto'

import { Octokit } from '@octokit/rest'

import { getPostAssetUrl, resolvePostAsset } from '#/lib/blog'
import { handleBlogAssetRequest } from '#/lib/blog-assets.server'
import {
	immutableTtlSeconds,
	publicationTtlSeconds,
	workerBlogCacheStore,
} from '#/lib/blog-cache.server'
import type { BlogCacheStore } from '#/lib/blog-cache.server'
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

function fixture(
	options: {
		cache?: BlogCacheStore
		now?: () => number
		versioned?: boolean
	} = {}
) {
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
	const trees = new Map<string, Array<Record<string, unknown>>>()
	const blobFiles = new Map<string, FixtureFile>()
	function captureTree() {
		const entries = files.map((file, index) => {
			const sha = options.versioned
				? createHash('sha1')
						.update(
							new Uint8Array(
								file.bytes ?? new TextEncoder().encode(file.source)
							)
						)
						.digest('hex')
				: (index + 1).toString(16).padStart(40, '0')
			blobFiles.set(sha, structuredClone(file))
			return {
				path: file.path,
				mode: file.mode ?? '100644',
				type: 'blob',
				sha,
				size: file.size,
			}
		})
		const sha = options.versioned
			? createHash('sha1').update(JSON.stringify(entries)).digest('hex')
			: treeSha
		trees.set(sha, entries)
		return sha
	}
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
				return Response.json({
					sha: head,
					commit: { tree: { sha: captureTree() } },
				})
			}
			const requestedTree = suffix.replace('git/trees/', '')
			if (suffix.startsWith('git/trees/') && trees.has(requestedTree)) {
				expect(url.searchParams.get('recursive')).toBe('1')
				return Response.json({
					truncated,
					tree: trees.get(requestedTree),
				})
			}
			const blob = /^git\/blobs\/([a-f0-9]{40})$/.exec(suffix)
			const file = blob ? blobFiles.get(blob[1]) : undefined
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
	const client = new Octokit({
		auth: 'test-only-token',
		request: { fetch },
		log: {
			debug: () => undefined,
			info: () => undefined,
			warn: () => undefined,
			error: () => undefined,
		},
	})
	const service = createBlogContentService(client, options)
	return {
		files,
		failures,
		fetch,
		service,
		client,
		setTruncated: () => (truncated = true),
		advanceHead: () => (head = nextCommit),
	}
}

afterEach(() => {
	configuration.token = undefined
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

function mockCache() {
	let time = Date.UTC(2026, 10, 15)
	const values = new Map<string, unknown>()
	const get = vi.fn<BlogCacheStore['get']>((key) =>
		Promise.resolve(structuredClone(values.get(key)))
	)
	const put = vi.fn<BlogCacheStore['put']>((key, value) => {
		values.set(key, structuredClone(value))
		return Promise.resolve()
	})
	return {
		values,
		get,
		put,
		now: () => time,
		advance: (seconds: number) => {
			time += seconds * 1000
		},
		key: (identity: string) => {
			const key = [...values.keys()].find((candidate) =>
				candidate.includes(`/${identity}/`)
			)
			if (!key) throw new Error(`No cache record for ${identity}`)
			return key
		},
	}
}

function cachedFixture() {
	const cache = mockCache()
	return { ...fixture({ cache, now: cache.now, versioned: true }), cache }
}

function mockWorkersCache() {
	const values = new Map<string, Response>()
	const match = vi.fn((key: string) =>
		Promise.resolve(values.get(key)?.clone())
	)
	const put = vi.fn((key: string, response: Response) => {
		values.set(key, response.clone())
		return Promise.resolve()
	})
	const open = vi.fn((_name: string) => Promise.resolve({ match, put }))
	vi.stubGlobal('caches', { open })
	return { values, match, put, open }
}

describe('blog server cache', () => {
	it('shares validated list, detail, and assets through the store across service instances', async () => {
		const { service, client, cache, fetch } = cachedFixture()
		const posts = await service.listPosts()
		expect(fetch).toHaveBeenCalledTimes(6)
		const anotherRequest = createBlogContentService(client, {
			cache,
			now: cache.now,
		})
		expect(await anotherRequest.listPosts()).toEqual(posts)
		expect((await anotherRequest.getPostBySlug('newer')).body).toBe(body)
		expect(fetch).toHaveBeenCalledTimes(6)
		const asset = await service.getPostAsset('newer', 'cover.png')
		expect(fetch).toHaveBeenCalledTimes(7)
		expect(await anotherRequest.getPostAsset('newer', './cover.png')).toEqual(
			asset
		)
		expect(fetch).toHaveBeenCalledTimes(7)
		expect(cache.put.mock.calls.map((call) => call[2])).toContain(
			publicationTtlSeconds
		)
		expect(
			cache.put.mock.calls.every((call) =>
				[publicationTtlSeconds, immutableTtlSeconds].includes(call[2])
			)
		).toBe(true)
		expect(JSON.stringify([...cache.values])).not.toMatch(
			/test-only-token|authorization|download_url|api.github.com|request|headers/i
		)
	})

	it('reduces a repeated detail from four GitHub reads to zero and returns independent values', async () => {
		const { service, fetch } = cachedFixture()
		const post = await service.getPostBySlug('newer')
		post.tags.push('caller mutation')
		post.author.name = 'caller mutation'
		post.assets['cover.png'].path = 'caller mutation'
		const again = await service.getPostBySlug('newer')
		expect(again.tags).toEqual(['markdown', 'blog'])
		expect(again.author.name).toBe('MrBoxs')
		expect(again.cover.src.path).toBe('posts/newer/cover.png')
		expect(fetch).toHaveBeenCalledTimes(4)
	})

	it('preserves CRLF Markdown and binary bytes across serialization without sharing mutable buffers', async () => {
		const { service, files, fetch } = cachedFixture()
		files[0].source = article('newer').replaceAll('\n', '\r\n') + '  \r\n'
		files[4].bytes = [0, 255, 128, 137, 80, 78, 71, 13, 10, 26, 10]
		const first = await service.getPostAsset('newer', 'cover.png')
		first.bytes.fill(42)
		const second = await service.getPostAsset('newer', 'cover.png')
		expect([...second.bytes]).toEqual(files[4].bytes)
		expect((await service.getPostBySlug('newer')).body).toBe(
			body.replaceAll('\n', '\r\n') + '  \r\n'
		)
		expect(fetch).toHaveBeenCalledTimes(5)
	})

	it('pins a fill to one commit, expires without sliding, and refreshes edits and author metadata', async () => {
		const { service, files, fetch, cache, advanceHead } = cachedFixture()
		const originalFetch = fetch.getMockImplementation()!
		let moved = false
		fetch.mockImplementation(async (...args) => {
			const response = await originalFetch(...args)
			if (!moved) {
				moved = true
				advanceHead()
				files[0].source =
					article('newer', { title: 'Edited title' }) + 'new body'
				files[3].source = JSON.stringify({
					name: 'Edited author',
					url: 'https://example.com',
				})
				files[4].bytes = [255, 0, 137]
			}
			return response
		})
		const original = await service.getPostAsset('newer', 'cover.png')
		expect((await service.getPostBySlug('newer')).title).toBe('Post newer')
		expect(fetch).toHaveBeenCalledTimes(5)
		cache.advance(publicationTtlSeconds - 1)
		expect(await service.getPostAsset('newer', 'cover.png')).toEqual(original)
		expect(fetch).toHaveBeenCalledTimes(5)
		cache.advance(1)
		const edited = await service.getPostBySlug('newer')
		expect(edited).toMatchObject({
			title: 'Edited title',
			author: { name: 'Edited author' },
			cover: { src: { commit: nextCommit } },
			body: `${body}new body`,
		})
		expect([
			...(await service.getPostAsset('newer', 'cover.png')).bytes,
		]).toEqual([255, 0, 137])
		expect(fetch).toHaveBeenCalledTimes(10)
	})

	it.each(['draft', 'deleted'])(
		'closes detail/list/images after expiry when a public article becomes %s, despite retained immutable bytes',
		async (change) => {
			const { service, files, cache, advanceHead, fetch } = cachedFixture()
			await service.getPostAsset('newer', 'cover.png')
			const imageKey = cache.key('image')
			if (change === 'draft') {
				files[0].source = article('newer', { draft: true })
			} else files.splice(0, 1)
			advanceHead()
			expect(
				(await service.getPostAsset('newer', 'cover.png')).bytes.byteLength
			).toBeGreaterThan(0)
			expect(fetch).toHaveBeenCalledTimes(5)
			cache.advance(publicationTtlSeconds)
			cache.get.mockClear()
			await expect(
				service.getPostAsset('newer', 'cover.png')
			).rejects.toMatchObject({ code: 'BLOG_ASSET_NOT_FOUND' })
			await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(
				PostNotFoundError
			)
			expect((await service.listPosts()).map((post) => post.slug)).toEqual([
				'older',
			])
			expect(cache.values.has(imageKey)).toBe(true)
			expect(cache.get.mock.calls.some(([key]) => key === imageKey)).toBe(false)
		}
	)

	it.each(['deleted', 'symlink'])(
		'checks current membership before cached bytes when an asset is %s',
		async (change) => {
			const { service, files, cache, advanceHead } = cachedFixture()
			await service.getPostAsset('newer', 'images/diagram.png')
			const imageKey = cache.key('image')
			if (change === 'deleted') files.pop()
			else files.at(-1)!.mode = '120000'
			advanceHead()
			cache.advance(publicationTtlSeconds)
			cache.get.mockClear()
			await expect(
				service.getPostAsset('newer', 'images/diagram.png')
			).rejects.toMatchObject({ code: 'BLOG_ASSET_NOT_FOUND' })
			expect(cache.values.has(imageKey)).toBe(true)
			expect(cache.get.mock.calls.some(([key]) => key === imageKey)).toBe(false)
			expect((await service.getPostBySlug('newer')).assets).not.toHaveProperty(
				'images/diagram.png'
			)
		}
	)

	it('refreshes newly published articles only after the mutable snapshot expires', async () => {
		const { service, files, cache, advanceHead } = cachedFixture()
		expect((await service.listPosts()).map((post) => post.slug)).toEqual([
			'newer',
			'older',
		])
		files[2].source = article('draft')
		advanceHead()
		await expect(service.getPostBySlug('draft')).rejects.toBeInstanceOf(
			PostNotFoundError
		)
		cache.advance(publicationTtlSeconds)
		expect((await service.listPosts()).map((post) => post.slug)).toEqual([
			'draft',
			'newer',
			'older',
		])
		await expect(
			service.getPostAsset('draft', 'cover.png')
		).resolves.toMatchObject({ contentType: 'image/png' })
	})

	it.each([
		{ status: 404, message: 'Not found', kind: 'access' },
		{ status: 403, message: 'Rate limit exceeded', kind: 'rate-limit' },
		{ status: 503, message: 'Unavailable', kind: 'upstream' },
	])(
		'fails closed on $kind after publication expiry and does not cache failures',
		async ({ kind, ...failure }) => {
			const { service, cache, failures, fetch } = cachedFixture()
			await service.getPostAsset('newer', 'cover.png')
			cache.advance(publicationTtlSeconds)
			failures.set('commits/main', failure)
			await expect(
				service.getPostAsset('newer', 'cover.png')
			).rejects.toMatchObject({ kind })
			await expect(service.getPostBySlug('missing')).rejects.toMatchObject({
				kind,
			})
			await expect(service.listPosts()).rejects.toMatchObject({ kind })
			expect(fetch).toHaveBeenCalledTimes(8)
			failures.clear()
			await expect(
				service.getPostAsset('newer', 'cover.png')
			).resolves.toMatchObject({ contentType: 'image/png' })
			expect(fetch).toHaveBeenCalledTimes(10)
		}
	)

	it.each(['get', 'put'] as const)(
		'treats cache %s failures as optimization misses and preserves source errors',
		async (method) => {
			const { service, cache, failures, fetch } = cachedFixture()
			cache[method].mockRejectedValue(new Error('cache unavailable'))
			const original = await service.getPostAsset('newer', 'cover.png')
			expect(await service.getPostAsset('newer', 'cover.png')).toEqual(original)
			expect(fetch).toHaveBeenCalledTimes(10)
			failures.set('commits/main', { status: 429, message: 'test-only-token' })
			await expect(service.getPostBySlug('missing')).rejects.toMatchObject({
				kind: 'rate-limit',
			})
			expect(JSON.stringify([...cache.values])).not.toMatch(
				/test-only-token|cache unavailable/
			)
		}
	)

	it.each(['post', 'author', 'image'])(
		'refetches malformed immutable %s data and keeps upstream 404 distinct',
		async (identity) => {
			const { service, cache, fetch } = cachedFixture()
			await service.getPostAsset('newer', 'cover.png')
			const key = cache.key(identity)
			const record = cache.values.get(key) as Record<string, unknown>
			cache.values.set(key, {
				...record,
				value:
					identity === 'image'
						? { encoding: 'base64', content: 'invalid!' }
						: {},
			})
			fetch.mockResolvedValueOnce(
				Response.json({ message: 'Not found' }, { status: 404 })
			)
			await expect(
				service.getPostAsset('newer', 'cover.png')
			).rejects.toMatchObject({ kind: 'access', status: 404 })
			await expect(
				service.getPostAsset('newer', 'cover.png')
			).resolves.toMatchObject({ contentType: 'image/png' })
			expect(fetch).toHaveBeenCalledTimes(7)
		}
	)

	it.each([
		'schema',
		'version',
		'key',
		'future',
		'ttl',
		'expired',
		'truncated',
		'duplicate',
	])(
		'discards a %s publication record instead of creating success or false 404',
		async (fault) => {
			const { service, cache, failures } = cachedFixture()
			await service.getPostAsset('newer', 'cover.png')
			const key = cache.key('publication')
			const record = cache.values.get(key) as Record<string, unknown>
			const value = record.value as {
				commit: unknown
				tree: { tree: Array<unknown>; truncated: boolean }
			}
			const changes: Record<string, unknown> = {
				schema: { value: null },
				version: { version: 99 },
				key: { key: 'other-repository/main' },
				future: {
					createdAt: cache.now() + 1,
					expiresAt: cache.now() + publicationTtlSeconds * 1000 + 1,
				},
				ttl: { expiresAt: cache.now() + immutableTtlSeconds * 1000 },
				expired: {
					createdAt: cache.now() - publicationTtlSeconds * 1000,
					expiresAt: cache.now(),
				},
				truncated: {
					value: { ...value, tree: { ...value.tree, truncated: true } },
				},
				duplicate: {
					value: {
						...value,
						tree: {
							...value.tree,
							tree: [...value.tree.tree, value.tree.tree[0]],
						},
					},
				},
			}
			cache.values.set(key, { ...record, ...(changes[fault] as object) })
			failures.set('commits/main', { status: 503, message: 'Unavailable' })
			await expect(
				service.getPostAsset('newer', 'cover.png')
			).rejects.toMatchObject({ kind: 'upstream' })
			await expect(service.getPostBySlug('missing')).rejects.toBeInstanceOf(
				BlogSourceError
			)
			failures.clear()
			await expect(service.getPostBySlug('newer')).resolves.toMatchObject({
				slug: 'newer',
			})
		}
	)

	it('reuses immutable authors/images after a main refresh, then refetches after their bounded TTL', async () => {
		const { service, cache, fetch, advanceHead } = cachedFixture()
		await service.getPostAsset('newer', 'cover.png')
		advanceHead()
		cache.advance(publicationTtlSeconds)
		await service.getPostAsset('newer', 'cover.png')
		expect(fetch).toHaveBeenCalledTimes(8)
		cache.advance(immutableTtlSeconds - publicationTtlSeconds)
		await service.getPostAsset('newer', 'cover.png')
		expect(fetch).toHaveBeenCalledTimes(12)
	})

	it('survives eviction and isolates injected clients and stores from the configured Worker cache', async () => {
		mockWorkersCache()
		const one = cachedFixture()
		await one.service.getPostBySlug('newer')
		const two = cachedFixture()
		two.failures.set('commits/main', { status: 401, message: 'Denied' })
		await expect(two.service.getPostBySlug('newer')).rejects.toMatchObject({
			kind: 'access',
		})
		const uncached = createBlogContentService(one.client)
		await uncached.getPostBySlug('newer')
		expect(one.fetch).toHaveBeenCalledTimes(8)
		one.cache.values.clear()
		await one.service.getPostBySlug('newer')
		expect(one.fetch).toHaveBeenCalledTimes(12)
	})

	it.each(['metadata', 'cover', 'author', 'tree', 'blob'])(
		'never caches invalid %s results as content or errors',
		async (fault) => {
			const { service, files, cache, setTruncated, fetch } = cachedFixture()
			if (fault === 'metadata') {
				files[0].source = article('newer', { title: '' })
			}
			if (fault === 'cover') {
				files[0].source = article('newer', {
					cover: { src: './missing.png', alt: 'Cover' },
				})
			}
			if (fault === 'author') files[3].source = '{}'
			if (fault === 'tree') setTruncated()
			if (fault === 'blob') {
				const originalFetch = fetch.getMockImplementation()!
				fetch.mockImplementation((...args) =>
					(args[0] instanceof Request
						? args[0].url
						: args[0].toString()
					).includes('/git/blobs/')
						? Promise.resolve(
								Response.json({ encoding: 'base64', content: 'invalid!' })
							)
						: originalFetch(...args)
				)
			}
			await expect(service.getPostBySlug('newer')).rejects.toBeInstanceOf(Error)
			expect(
				[...cache.values.keys()].some(
					(key) =>
						key.includes('/post/') ||
						key.includes('/author/') ||
						key.includes('/image/')
				)
			).toBe(false)
			if (fault === 'tree') expect(cache.values.size).toBe(0)
			expect(JSON.stringify([...cache.values])).not.toMatch(
				/INVALID_BLOG_CONTENT|BLOG_SOURCE_ERROR|test-only-token/
			)
		}
	)

	it('rechecks tree sizes before cached image reads and rejects historical/unsafe URLs without I/O', async () => {
		const { service, cache, files, advanceHead } = cachedFixture()
		await service.getPostAsset('newer', 'cover.png')
		cache.get.mockClear()
		for (const path of [
			`${commit}/cover.png`,
			'../draft/cover.png',
			`cover.png?ref=${commit}`,
			'index.md',
		]) {
			await expect(service.getPostAsset('newer', path)).rejects.toMatchObject({
				code: 'BLOG_ASSET_NOT_FOUND',
			})
		}
		// A historical-looking nested path is safe syntax but still fails membership.
		expect(cache.get.mock.calls.some(([key]) => key.includes('/image/'))).toBe(
			false
		)
		files[4].size = 5 * 1024 * 1024 + 1
		advanceHead()
		cache.advance(publicationTtlSeconds)
		cache.get.mockClear()
		await expect(
			service.getPostAsset('newer', 'cover.png')
		).rejects.toMatchObject({ code: 'BLOG_ASSET_TOO_LARGE' })
		expect(cache.get.mock.calls.some(([key]) => key.includes('/image/'))).toBe(
			false
		)
	})
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
	function setup(versioned = false) {
		const result = fixture({ versioned })
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

	it('uses the Workers cache across configured GET/HEAD calls while preserving security headers and call-time secrets', async () => {
		const workerCache = mockWorkersCache()
		const { files, fetch } = setup(true)
		files[4].bytes = [0, 255, 128, 137, 80, 78, 71]
		const first = await request()
		const second = await request('newer', 'cover.png', 'HEAD')
		const third = await request()
		expect(first.status).toBe(200)
		expect([...second.headers]).toEqual([...first.headers])
		expect(second.headers.get('Cache-Control')).toBe('no-store')
		expect(second.headers.get('X-Content-Type-Options')).toBe('nosniff')
		expect(second.headers.get('Cross-Origin-Resource-Policy')).toBe(
			'same-origin'
		)
		expect(second.headers.get('Content-Security-Policy')).toContain('sandbox')
		expect(await second.text()).toBe('')
		expect([...new Uint8Array(await first.arrayBuffer())]).toEqual(
			files[4].bytes
		)
		expect([...new Uint8Array(await third.arrayBuffer())]).toEqual(
			files[4].bytes
		)
		expect(fetch).toHaveBeenCalledTimes(5)
		expect(
			workerCache.open.mock.calls.every((args) => args[0] === 'blog-content-v1')
		).toBe(true)
		expect(workerCache.values.size).toBe(4)
		for (const [key, value] of workerCache.values) {
			expect(key).toMatch(
				/^https:\/\/blog-cache.internal\/blog-content-v1\/mrboxs\/written-by-boxs\//
			)
			expect(key).not.toMatch(/token|authorization/)
			expect(value.headers.get('Cache-Control')).toMatch(
				/^max-age=(600|86400)$/
			)
		}
		workerCache.match.mockClear()
		configuration.token = '  '
		expect((await request()).status).toBe(500)
		await expect(listPosts()).rejects.toMatchObject({ kind: 'configuration' })
		expect(workerCache.match).not.toHaveBeenCalled()
		expect(fetch).toHaveBeenCalledTimes(5)
	})

	it('expires publication through the real adapter, fails closed on rate limits, and gates retained bytes after public-to-draft', async () => {
		const workerCache = mockWorkersCache()
		const clock = mockCache()
		vi.spyOn(Date, 'now').mockImplementation(clock.now)
		const { files, failures, advanceHead, fetch } = setup(true)
		expect((await request()).status).toBe(200)
		files[0].source = article('newer', { draft: true })
		advanceHead()
		clock.advance(publicationTtlSeconds - 1)
		expect((await request()).status).toBe(200)
		expect(fetch).toHaveBeenCalledTimes(5)
		clock.advance(1)
		failures.set('commits/main', { status: 429, message: 'asset-test-token' })
		const unavailable = await request('newer', 'cover.png', 'HEAD')
		expect(unavailable.status).toBe(503)
		expect(await unavailable.text()).toBe('')
		expect(unavailable.headers.get('Cache-Control')).toBe('no-store')
		failures.clear()
		workerCache.match.mockClear()
		const hidden = await request()
		expect(hidden.status).toBe(404)
		expect(await hidden.text()).toBe('Not found')
		expect(hidden.headers.get('Cache-Control')).toBe('no-store')
		expect(
			[...workerCache.values.keys()].some((key) => key.includes('/image/'))
		).toBe(true)
		expect(
			workerCache.match.mock.calls.some(([key]) => key.includes('/image/'))
		).toBe(false)
	})

	it.each(['json', 'utf8', 'status', 'oversized', 'read-failure'])(
		'treats a %s Workers cache response as a miss and preserves sanitized upstream errors',
		async (fault) => {
			const workerCache = mockWorkersCache()
			const { failures } = setup(true)
			await request()
			const key = [...workerCache.values.keys()].find((value) =>
				value.includes('/publication/')
			)!
			if (fault === 'json') workerCache.values.set(key, new Response('{broken'))
			if (fault === 'utf8') {
				workerCache.values.set(key, new Response(new Uint8Array([255])))
			}
			if (fault === 'status') {
				workerCache.values.set(key, new Response('{}', { status: 503 }))
			}
			if (fault === 'oversized') {
				workerCache.match.mockResolvedValueOnce(
					new Response('x'.repeat(8 * 1024 * 1024 + 1))
				)
			}
			if (fault === 'read-failure') {
				workerCache.match.mockRejectedValueOnce(new Error('cache error'))
			}
			failures.set('commits/main', { status: 404, message: 'asset-test-token' })
			const response = await request()
			expect(response.status).toBe(502)
			expect(await response.text()).toBe('Asset temporarily unavailable')
			expect(response.headers.get('Cache-Control')).toBe('no-store')
		}
	)

	it('skips cache writes over 8 MiB and survives a Workers cache write failure', async () => {
		const workerCache = mockWorkersCache()
		await workerBlogCacheStore.put(
			'test-only-size-bound',
			'x'.repeat(8 * 1024 * 1024),
			immutableTtlSeconds
		)
		expect(workerCache.put).not.toHaveBeenCalled()
		const { fetch } = setup(true)
		workerCache.put.mockRejectedValue(new Error('cache write unavailable'))
		expect((await request()).status).toBe(200)
		expect((await request('newer', 'cover.png', 'HEAD')).status).toBe(200)
		expect(fetch).toHaveBeenCalledTimes(10)
	})

	it('round-trips an image exactly at 5 MiB but rejects an oversized cached payload before serving it', async () => {
		const workerCache = mockWorkersCache()
		const { fetch } = setup()
		const originalFetch = fetch.getMockImplementation()!
		const maxBytes = 5 * 1024 * 1024
		let content = btoa('\0'.repeat(maxBytes))
		fetch.mockImplementation((...args) =>
			(args[0] instanceof Request ? args[0].url : args[0].toString()).endsWith(
				`/git/blobs/${'5'.padStart(40, '0')}`
			)
				? Promise.resolve(Response.json({ encoding: 'base64', content }))
				: originalFetch(...args)
		)
		const first = await request()
		const warm = await request()
		expect(first.status).toBe(200)
		expect(warm.status).toBe(200)
		expect(warm.headers.get('Content-Length')).toBe(String(maxBytes))
		const bytes = new Uint8Array(await warm.arrayBuffer())
		expect(bytes.byteLength).toBe(maxBytes)
		expect(bytes.every((byte) => byte === 0)).toBe(true)
		expect(fetch).toHaveBeenCalledTimes(5)
		const key = [...workerCache.values.keys()].find((value) =>
			value.includes('/image/')
		)!
		const record: Record<string, unknown> = await workerCache.values
			.get(key)!
			.clone()
			.json()
		content = btoa('\0'.repeat(maxBytes + 1))
		workerCache.values.set(
			key,
			Response.json({ ...record, value: { encoding: 'base64', content } })
		)
		expect((await request()).status).toBe(413)
		expect(fetch).toHaveBeenCalledTimes(6)
	})

	it('retains the 5 MiB decoded limit when the tree omits image size, without caching oversized bytes', async () => {
		const workerCache = mockWorkersCache()
		const { fetch } = setup()
		const originalFetch = fetch.getMockImplementation()!
		fetch.mockImplementation((...args) =>
			(args[0] instanceof Request ? args[0].url : args[0].toString()).endsWith(
				`/git/blobs/${'5'.padStart(40, '0')}`
			)
				? Promise.resolve(
						Response.json({
							encoding: 'base64',
							content: btoa('\0'.repeat(5 * 1024 * 1024 + 1)),
						})
					)
				: originalFetch(...args)
		)
		expect((await request()).status).toBe(413)
		expect(
			[...workerCache.values.keys()].some((key) => key.includes('/image/'))
		).toBe(false)
	})

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
