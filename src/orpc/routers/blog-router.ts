import {
	BlogSourceError,
	getPostBySlug,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'
import { publicProcedures } from '#/orpc/procedures'

export const blogRouter = {
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
		async ({ input, errors }) => {
			try {
				return await getPostBySlug(input.params.slug)
			} catch (error) {
				if (error instanceof PostNotFoundError) throw errors.NOT_FOUND()
				if (error instanceof BlogSourceError && error.kind === 'rate-limit') {
					throw errors.TOO_MANY_REQUESTS()
				}
				throw errors.INTERNAL_SERVER_ERROR()
			}
		}
	),
}
