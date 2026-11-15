export interface BlogAsset {
	commit: string
	path: string
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

/** Resolve a Markdown image destination without fetching or rewriting the body. */
export function resolvePostAsset(
	post: Pick<BlogPost, 'assets'>,
	reference: string
): BlogAsset | undefined {
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
	return Object.hasOwn(post.assets, path) ? post.assets[path] : undefined
}
