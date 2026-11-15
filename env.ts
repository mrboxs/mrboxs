import { defineEnv, string } from 'void/env'

export default defineEnv({
	GITHUB_BLOG_TOKEN: string().optional(),
	APP_URL: string().default('http://localhost:3000'),

	VITE_APP_URL: string().default('http://localhost:3000'),
})
