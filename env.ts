import { defineEnv, string } from 'void/env'

export default defineEnv({
	GITHUB_BLOG_TOKEN: string().optional(),
})
