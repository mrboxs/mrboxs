import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract } from '#/orpc/contracts/base-contract'

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const textSchema = z.string().refine((value) => value.trim().length > 0)
const blogAssetSchema = z.object({
	commit: z.string().regex(/^[a-f0-9]{40}$/),
	path: textSchema,
})
const blogAuthorSchema = z.object({
	id: slugSchema,
	name: textSchema,
	url: z.url({ protocol: /^https?$/ }).refine((value) => {
		const url = new URL(value)
		return !url.username && !url.password
	}),
	bio: textSchema.optional(),
})
const blogMetadataSchema = z.object({
	title: textSchema,
	slug: slugSchema,
	description: textSchema,
	publishedAt: z.iso.date(),
	tags: z.array(textSchema),
	author: blogAuthorSchema,
	cover: z.object({ src: blogAssetSchema, alt: textSchema }),
})
const codeTokenStyleSchema = z.object({
	color: z.string().optional(),
	bgColor: z.string().optional(),
	fontStyle: z.number().int().optional(),
})
const blogPostSchema = blogMetadataSchema.extend({
	body: z.string(),
	assets: z.record(z.string(), blogAssetSchema),
	prepared: z.object({
		codeBlocks: z.record(
			z.string(),
			z.object({
				code: z.string(),
				language: z.string(),
				tokens: z
					.array(
						z.array(
							z.object({
								content: z.string(),
								light: codeTokenStyleSchema,
								dark: codeTokenStyleSchema,
							})
						)
					)
					.optional(),
				colors: z
					.object({
						light: codeTokenStyleSchema,
						dark: codeTokenStyleSchema,
					})
					.optional(),
			})
		),
	}),
})

export const blogContract = {
	revision: baseContract
		.meta(
			openapi({
				path: '/blog-revision',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				operationId: 'getBlogRevision',
				tags: ['Blogs'],
			})
		)
		.input(z.object({}))
		.output(z.object({ revision: z.string().regex(/^[a-f0-9]{40}$/) })),

	list: baseContract
		.meta(
			openapi({
				path: '/blogs',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				operationId: 'listBlogs',
				tags: ['Blogs'],
			})
		)
		.input(z.object({}))
		.output(z.array(blogMetadataSchema)),

	getBySlug: baseContract
		.meta(
			openapi({
				path: '/blogs/{slug}',
				method: 'GET',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				operationId: 'getBlogBySlug',
				tags: ['Blogs'],
			})
		)
		.input(z.object({ params: z.object({ slug: slugSchema }) }))
		.output(blogPostSchema),
}
