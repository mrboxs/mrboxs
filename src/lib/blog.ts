export interface BlogAsset {
	commit: string
	path: string
}

export function normalizePostAssetPath(reference: string): string | undefined {
	const path = reference.startsWith('./') ? reference.slice(2) : reference
	if (
		/[\\%:?#]/.test(path) ||
		Array.from(path).some(
			(char) => char.charCodeAt(0) < 32 || char === '\u007F'
		) ||
		path.split('/').some((part) => !part || part === '.' || part === '..')
	) {
		return undefined
	}
	return path
}

/** The endpoint always checks the current public article, not a caller's commit. */
export function getPostAssetUrl(asset: BlogAsset): string | undefined {
	const match = /^posts\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(.+)$/.exec(asset.path)
	if (!match) return undefined
	const path = normalizePostAssetPath(match[2])
	if (!path) return undefined
	return `/api/blog/assets/${match[1]}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export interface BlogAuthor {
	id: string
	name: string
	url: string
	bio?: string
}

export interface PostMetadata {
	title: string
	slug: string
	description: string
	publishedAt: string
	tags: Array<string>
	author: BlogAuthor
	cover: { src: BlogAsset; alt: string }
}

export interface BlogPost extends PostMetadata {
	body: string
	/** Keys are paths relative to the post folder, without a leading ./ . */
	assets: Record<string, BlogAsset>
}

export function getPostMarkdown(
	post: Pick<BlogPost, 'title' | 'description' | 'body'>
): string {
	return `# ${post.title}\n\n${post.description}\n\n${post.body}`
}

/** Resolve a Markdown image destination without fetching or rewriting the body. */
export function resolvePostAsset(
	post: Pick<BlogPost, 'assets'>,
	reference: string
): BlogAsset | undefined {
	const path = normalizePostAssetPath(reference)
	return path && Object.hasOwn(post.assets, path)
		? post.assets[path]
		: undefined
}
