import type { BlogPost, PostMetadata } from '#/lib/blog'

export const blogMetadata: PostMetadata = {
	title: 'Tulisan Pertama',
	slug: 'tulisan-pertama',
	description: 'Catatan pertama.',
	publishedAt: '2026-11-15',
	tags: ['personal'],
	author: { id: 'mrboxs', name: 'MrBoxs', url: 'https://github.com/mrboxs' },
	cover: {
		src: { commit: 'a'.repeat(40), path: 'posts/tulisan-pertama/cover.png' },
		alt: 'Cover tulisan pertama.',
	},
}

export const blogPost: BlogPost = {
	...blogMetadata,
	body: '## Heading mentah\n\n**Teks tebal**\n<script>alert("test")</script>\n![Cover](./cover.png)\n',
	assets: { 'cover.png': blogMetadata.cover.src },
}
