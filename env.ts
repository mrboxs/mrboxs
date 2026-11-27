import { defineEnv, string, url } from 'void/env'

const defaultAppUrl = 'https://iamboxs.web.id'

export default defineEnv({
	GITHUB_BLOG_TOKEN: string().optional(),
	APP_URL: url().default(defaultAppUrl),
	VITE_APP_URL: url().default(defaultAppUrl),
})
