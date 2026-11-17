import '@tanstack/react-start/server-only'
import { z } from 'zod'

const namespace = 'blog-content-v1/mrboxs/written-by-boxs'
const maxRecordBytes = 8 * 1024 * 1024
// Snapshot retention for conditional revalidation, not a publication delay.
export const publicationTtlSeconds = 10 * 60
export const immutableTtlSeconds = 24 * 60 * 60

/** Stores are explicitly injected for tests; no injected client uses the deployed cache. */
export interface BlogCacheStore {
	get(key: string): Promise<unknown>
	put(key: string, value: unknown, ttlSeconds: number): Promise<void>
}

const recordSchema = z.strictObject({
	version: z.literal(1),
	key: z.string(),
	createdAt: z.number().int().nonnegative(),
	expiresAt: z.number().int().nonnegative(),
	value: z.unknown(),
})

export function createBlogCache(
	store?: BlogCacheStore,
	now: () => number = Date.now
) {
	return async function cached<T>(
		identity: string,
		ttlSeconds: number,
		schema: z.ZodType<T>,
		load: (previous: T | undefined) => Promise<T>,
		options: { revalidate?: boolean } = {}
	): Promise<T> {
		const key = `${namespace}/${identity}`
		let previous: T | undefined
		if (store) {
			try {
				const record = recordSchema.safeParse(await store.get(key))
				const time = now()
				if (
					record.success &&
					record.data.key === key &&
					record.data.createdAt <= time &&
					record.data.expiresAt > time &&
					record.data.expiresAt - record.data.createdAt === ttlSeconds * 1000
				) {
					const value = schema.safeParse(record.data.value)
					if (value.success) {
						if (!options.revalidate) return value.data
						previous = value.data
					}
				}
			} catch {
				// Cache availability never establishes publication or source failure.
			}
		}
		// Start freshness before I/O; a slow fill must not extend publication validity.
		const createdAt = now()
		const value = await load(previous)
		if (store && now() < createdAt + ttlSeconds * 1000) {
			try {
				await store.put(
					key,
					{
						version: 1,
						key,
						createdAt,
						expiresAt: createdAt + ttlSeconds * 1000,
						value,
					},
					ttlSeconds
				)
			} catch {
				// A validated upstream result remains usable when the optimization fails.
			}
		}
		return value
	}
}

async function readRecord(response: Response): Promise<unknown> {
	if (response.status !== 200 || !response.body) return undefined
	const reader = response.body.getReader()
	const chunks: Array<Uint8Array> = []
	let length = 0
	try {
		for (;;) {
			const result = await reader.read()
			if (result.done) break
			const chunk: unknown = result.value
			if (!(chunk instanceof Uint8Array)) return undefined
			length += chunk.byteLength
			if (length > maxRecordBytes) return undefined
			chunks.push(chunk)
		}
	} finally {
		await reader.cancel()
	}
	const bytes = new Uint8Array(length)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.byteLength
	}
	return JSON.parse(
		new TextDecoder('utf-8', { fatal: true }).decode(bytes)
	) as unknown
}

/** Named Workers cache, separate from HTTP/ISR caching; these URLs are never fetched. */
export const workerBlogCacheStore: BlogCacheStore = {
	async get(key) {
		const cache = await caches.open('blog-content-v1')
		const response = await cache.match(`https://blog-cache.internal/${key}`)
		return response ? readRecord(response) : undefined
	},
	async put(key, value, ttlSeconds) {
		const bytes = new TextEncoder().encode(JSON.stringify(value))
		if (bytes.byteLength > maxRecordBytes) return
		const cache = await caches.open('blog-content-v1')
		await cache.put(
			`https://blog-cache.internal/${key}`,
			new Response(bytes, {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': `max-age=${ttlSeconds}`,
				},
			})
		)
	},
}
