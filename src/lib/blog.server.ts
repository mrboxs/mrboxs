import '@tanstack/react-start/server-only'
import { env } from 'void/env'

import { Octokit } from '@octokit/rest'
import { parseDocument } from 'yaml'
import { z } from 'zod'

import { normalizePostAssetPath, resolvePostAsset } from '#/lib/blog'
import type { BlogAsset, BlogAuthor, BlogPost, PostMetadata } from '#/lib/blog'

const repository = {
	owner: 'mrboxs',
	repo: 'written-by-boxs',
	headers: { 'X-GitHub-Api-Version': '2022-11-28' },
} as const
const branch = 'main'
const maxBlobBytes = 5 * 1024 * 1024
const imageTypes: Readonly<Record<string, string>> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	svg: 'image/svg+xml',
}

function assetContentType(path: string): string | undefined {
	const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? ''
	return Object.hasOwn(imageTypes, extension)
		? imageTypes[extension]
		: undefined
}
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const shaSchema = z.string().regex(/^[a-f0-9]{40}$/)
const textSchema = z.string().refine((value) => value.trim().length > 0)
const frontmatterSchema = z.object({
	title: textSchema,
	slug: slugSchema,
	description: textSchema,
	publishedAt: z.iso.date(),
	tags: z.array(textSchema),
	draft: z.boolean(),
	author: slugSchema,
	cover: z.object({ src: textSchema, alt: textSchema }),
})
const authorSchema = z.object({
	name: textSchema,
	url: z.url({ protocol: /^https?$/ }).refine((value) => {
		const url = new URL(value)
		return !url.username && !url.password
	}),
	bio: textSchema.optional(),
})
const commitSchema = z.object({
	sha: shaSchema,
	commit: z.object({ tree: z.object({ sha: shaSchema }) }),
})
const treeSchema = z.object({
	truncated: z.literal(false),
	tree: z.array(
		z.object({
			path: z.string(),
			mode: z.string(),
			type: z.enum(['blob', 'tree', 'commit']),
			sha: shaSchema,
			size: z.number().int().nonnegative().optional(),
		})
	),
})
const blobSchema = z.object({
	encoding: z.literal('base64'),
	content: z.string(),
})
const githubErrorSchema = z.object({
	status: z.number().optional(),
	response: z
		.object({
			headers: z.object({
				'x-ratelimit-remaining': z.string().optional(),
				'retry-after': z.string().optional(),
			}),
			data: z.unknown().optional(),
		})
		.optional(),
})
const githubMessageSchema = z.object({ message: z.string() })

export class PostNotFoundError extends Error {
	readonly code = 'POST_NOT_FOUND'
	constructor() {
		super('Post not found')
		this.name = 'PostNotFoundError'
	}
}

export class AssetNotFoundError extends Error {
	readonly code = 'BLOG_ASSET_NOT_FOUND'
	constructor() {
		super('Asset not found')
		this.name = 'AssetNotFoundError'
	}
}

export class BlogAssetTooLargeError extends Error {
	readonly code = 'BLOG_ASSET_TOO_LARGE'
	constructor() {
		super('Blog asset exceeds the 5 MiB limit')
		this.name = 'BlogAssetTooLargeError'
	}
}

export class InvalidBlogContentError extends Error {
	readonly code = 'INVALID_BLOG_CONTENT'
	constructor(
		readonly path: string,
		readonly field: string
	) {
		super(`Invalid blog content: ${path} (${field})`)
		this.name = 'InvalidBlogContentError'
	}
}

export class BlogSourceError extends Error {
	readonly code = 'BLOG_SOURCE_ERROR'
	constructor(
		readonly kind:
			| 'configuration'
			| 'access'
			| 'rate-limit'
			| 'network'
			| 'upstream'
			| 'invalid-response',
		readonly status?: number
	) {
		super(`Blog source unavailable: ${kind}`)
		this.name = 'BlogSourceError'
	}
}

async function githubRequest<T>(
	request: (signal: AbortSignal) => Promise<{ data: T }>
): Promise<T> {
	try {
		return (await request(AbortSignal.timeout(10_000))).data
	} catch (error) {
		// Octokit errors contain request headers. Never retain or propagate them.
		const parsed = githubErrorSchema.safeParse(error)
		const { status, response } = parsed.success ? parsed.data : {}
		const message = githubMessageSchema.safeParse(response?.data)
		if (
			status === 429 ||
			(status === 403 &&
				(response?.headers['x-ratelimit-remaining'] === '0' ||
					response?.headers['retry-after'] !== undefined ||
					(message.success && /rate limit/i.test(message.data.message))))
		) {
			throw new BlogSourceError('rate-limit', status)
		}
		if (status === 401 || status === 403 || status === 404) {
			throw new BlogSourceError('access', status)
		}
		throw new BlogSourceError(response ? 'upstream' : 'network', status)
	}
}

function sourceData<T>(schema: z.ZodType<T>, data: unknown): T {
	const result = schema.safeParse(data)
	if (!result.success) throw new BlogSourceError('invalid-response')
	return result.data
}

function contentData<T>(
	schema: z.ZodType<T>,
	data: unknown,
	path: string,
	field: string
): T {
	const result = schema.safeParse(data)
	if (!result.success) throw new InvalidBlogContentError(path, field)
	return result.data
}

function parsePost(source: string, slug: string) {
	const path = `posts/${slug}/index.md`
	// Match only the leading block; body delimiters and fenced YAML stay intact.
	const match = /^\uFEFF?---[\t ]*\r?\n([\s\S]*?)^---[\t ]*(?:\r?\n|$)/m.exec(
		source
	)
	if (match?.index !== 0) {
		throw new InvalidBlogContentError(path, 'frontmatter')
	}
	let data: unknown
	try {
		const document = parseDocument(match[1], { schema: 'core' })
		if (document.errors.length > 0 || document.warnings.length > 0) {
			throw new Error('Invalid YAML')
		}
		data = document.toJS({ maxAliasCount: 0 })
	} catch {
		throw new InvalidBlogContentError(path, 'frontmatter')
	}
	const metadata = contentData(frontmatterSchema, data, path, 'metadata')
	if (metadata.slug !== slug) {
		throw new InvalidBlogContentError(path, 'slug must match folder')
	}
	return { metadata, body: source.slice(match[0].length) }
}

/** Dependency injection is for server tests; repository coordinates stay fixed. */
export function createBlogContentService(client: Octokit) {
	async function snapshot() {
		const commit = sourceData(
			commitSchema,
			await githubRequest((signal) =>
				client.repos.getCommit({
					...repository,
					ref: branch,
					request: { signal },
				})
			)
		)
		const tree = sourceData(
			treeSchema,
			await githubRequest((signal) =>
				client.git.getTree({
					...repository,
					tree_sha: commit.commit.tree.sha,
					recursive: '1',
					request: { signal },
				})
			)
		)
		const files = new Map(tree.tree.map((entry) => [entry.path, entry]))
		if (files.size !== tree.tree.length) {
			throw new BlogSourceError('invalid-response')
		}
		// These maps live for one operation, never across requests or commits.
		const blobs = new Map<string, Promise<Uint8Array<ArrayBuffer>>>()
		const authors = new Map<string, Promise<BlogAuthor>>()

		function readBytes(path: string): Promise<Uint8Array<ArrayBuffer>> {
			const entry = files.get(path)
			if (
				entry?.type !== 'blob' ||
				!['100644', '100755'].includes(entry.mode)
			) {
				throw new InvalidBlogContentError(path, 'missing regular file')
			}
			if (entry.size !== undefined && entry.size > maxBlobBytes) {
				throw new BlogAssetTooLargeError()
			}
			let pending = blobs.get(entry.sha)
			if (!pending) {
				pending = githubRequest((signal) =>
					client.git.getBlob({
						...repository,
						file_sha: entry.sha,
						request: { signal },
					})
				).then((data) => {
					const blob = sourceData(blobSchema, data)
					// Bound decoded allocation even if tree size is missing or inaccurate.
					if (
						blob.content.replace(/\s/g, '').length >
						Math.ceil(maxBlobBytes / 3) * 4
					) {
						throw new BlogAssetTooLargeError()
					}
					let bytes: Uint8Array<ArrayBuffer>
					try {
						bytes = Uint8Array.from(atob(blob.content), (char) =>
							char.charCodeAt(0)
						)
					} catch {
						throw new BlogSourceError('invalid-response')
					}
					if (bytes.byteLength > maxBlobBytes) {
						throw new BlogAssetTooLargeError()
					}
					return bytes
				})
				blobs.set(entry.sha, pending)
			}
			return pending
		}

		async function readText(path: string): Promise<string> {
			const bytes = await readBytes(path)
			try {
				return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
			} catch {
				throw new BlogSourceError('invalid-response')
			}
		}

		function readAuthor(id: string): Promise<BlogAuthor> {
			const path = `authors/${id}.json`
			let pending = authors.get(id)
			if (!pending) {
				pending = readText(path).then((source) => {
					let data: unknown
					try {
						data = JSON.parse(source)
					} catch {
						throw new InvalidBlogContentError(path, 'JSON')
					}
					return { id, ...contentData(authorSchema, data, path, 'author') }
				})
				authors.set(id, pending)
			}
			return pending
		}

		async function readPost(slug: string): Promise<BlogPost | undefined> {
			const { metadata, body } = parsePost(
				await readText(`posts/${slug}/index.md`),
				slug
			)
			if (metadata.draft) return undefined
			const prefix = `posts/${slug}/`
			const assets: Record<string, BlogAsset> = Object.fromEntries(
				tree.tree
					.filter(
						(entry) =>
							entry.path.startsWith(prefix) &&
							entry.path !== `${prefix}index.md` &&
							entry.type === 'blob' &&
							['100644', '100755'].includes(entry.mode)
					)
					.map((entry) => [
						entry.path.slice(prefix.length),
						{ commit: commit.sha, path: entry.path },
					])
			)
			const cover = resolvePostAsset({ assets }, metadata.cover.src)
			if (!cover || !assetContentType(cover.path)) {
				throw new InvalidBlogContentError(`${prefix}index.md`, 'cover.src')
			}
			return {
				title: metadata.title,
				slug,
				description: metadata.description,
				publishedAt: metadata.publishedAt,
				tags: metadata.tags,
				author: await readAuthor(metadata.author),
				cover: { src: cover, alt: metadata.cover.alt },
				body,
				assets,
			}
		}
		return { files, readPost, readBytes }
	}

	return {
		async getPostAsset(slug: string, reference: string) {
			const path = normalizePostAssetPath(reference)
			const contentType = path ? assetContentType(path) : undefined
			if (!slugSchema.safeParse(slug).success || !path || !contentType) {
				throw new AssetNotFoundError()
			}
			const { files, readPost, readBytes } = await snapshot()
			if (!files.has(`posts/${slug}/index.md`)) throw new AssetNotFoundError()
			const post = await readPost(slug)
			const asset = post ? resolvePostAsset(post, path) : undefined
			if (!asset) throw new AssetNotFoundError()
			return { bytes: await readBytes(asset.path), contentType }
		},
		async listPosts(): Promise<Array<PostMetadata>> {
			const { files, readPost } = await snapshot()
			const slugs = [...files.keys()].flatMap((path) => {
				const match = /^posts\/([^/]+)\/index\.md$/.exec(path)
				if (!match) return []
				return [contentData(slugSchema, match[1], path, 'folder slug')]
			})
			const posts = await Promise.all(slugs.map(readPost))
			const metadata = posts
				.filter((post) => post !== undefined)
				.map(
					({ body: _body, assets: _assets, ...postMetadata }) => postMetadata
				)
			metadata.sort(
				(a, b) =>
					b.publishedAt.localeCompare(a.publishedAt) ||
					a.slug.localeCompare(b.slug)
			)
			return metadata
		},
		async getPostBySlug(slug: string): Promise<BlogPost> {
			if (!slugSchema.safeParse(slug).success) throw new PostNotFoundError()
			const { files, readPost } = await snapshot()
			if (!files.has(`posts/${slug}/index.md`)) throw new PostNotFoundError()
			const post = await readPost(slug)
			if (!post) throw new PostNotFoundError()
			return post
		},
	}
}

function configuredService() {
	// Void supplies Worker secrets at request time, not module evaluation time.
	const token = env.GITHUB_BLOG_TOKEN
	if (!token?.trim()) throw new BlogSourceError('configuration')
	return createBlogContentService(
		new Octokit({
			auth: token,
			userAgent: 'mrboxs-blog',
			log: {
				debug: () => undefined,
				info: () => undefined,
				warn: () => undefined,
				error: () => undefined,
			},
		})
	)
}

export async function listPosts(): Promise<Array<PostMetadata>> {
	return configuredService().listPosts()
}

export async function getPostBySlug(slug: string): Promise<BlogPost> {
	if (!slugSchema.safeParse(slug).success) throw new PostNotFoundError()
	return configuredService().getPostBySlug(slug)
}

export async function getPostAsset(slug: string, reference: string) {
	// Validate before resolving credentials as well as at the injected service boundary.
	const path = normalizePostAssetPath(reference)
	if (!slugSchema.safeParse(slug).success || !path || !assetContentType(path)) {
		throw new AssetNotFoundError()
	}
	return configuredService().getPostAsset(slug, path)
}
