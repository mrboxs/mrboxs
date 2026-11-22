import { defineEnv, string, url } from 'void/env'

const defaultAppUrl = 'https://mrboxs.isntboxs.workers.dev'

export default defineEnv({
	GITHUB_BLOG_TOKEN: string().optional(),
	APP_URL: url().default(defaultAppUrl),
	VITE_APP_URL: url().default(defaultAppUrl),
})
