import { createError } from 'evlog'

import { ORPC_ERRORS } from '#/constants/orpc-errors'
import {
	BlogSourceError,
	getBlogRevision,
	getPostBySlug,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'
import { publicProcedures } from '#/orpc/procedures'

export const blogRouter = {
	revision: publicProcedures.blog.revision.handler(async ({ errors }) => {
		try {
			return { revision: await getBlogRevision() }
		} catch (error) {
			if (error instanceof BlogSourceError && error.kind === 'rate-limit') {
				throw errors.TOO_MANY_REQUESTS()
			}
			throw errors.INTERNAL_SERVER_ERROR()
		}
	}),

	list: publicProcedures.blog.list.handler(async ({ errors }) => {
		try {
			return await listPosts()
		} catch (error) {
			if (error instanceof BlogSourceError && error.kind === 'rate-limit') {
				throw errors.TOO_MANY_REQUESTS()
			}
			throw errors.INTERNAL_SERVER_ERROR()
		}
	}),

	getBySlug: publicProcedures.blog.getBySlug.handler(
		async ({ input, context, errors }) => {
			context.log?.set({ blog: { slug: input.params.slug } })
			try {
				const post = await getPostBySlug(input.params.slug)
				const { prepareMarkdown } =
					await import('#/lib/markdown-prepare.server')
				return { ...post, prepared: await prepareMarkdown(post.body) }
			} catch (error) {
				if (error instanceof PostNotFoundError) {
					throw createError({
						code: 'NOT_FOUND',
						...ORPC_ERRORS.NOT_FOUND,
						why: 'The article is missing or unpublished.',
						fix: 'Check the slug or choose a published article.',
						link: '/blog',
					})
				}
				if (error instanceof BlogSourceError && error.kind === 'rate-limit') {
					throw errors.TOO_MANY_REQUESTS()
				}
				throw errors.INTERNAL_SERVER_ERROR()
			}
		}
	),
}
