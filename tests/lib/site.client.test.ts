import { describe, expect, it, vi } from 'vite-plus/test'

import { publicUrl, site } from '#/lib/site'

vi.mock('@tanstack/react-start', () => ({
	createIsomorphicFn: () => ({
		server: () => ({ client: <T>(factory: () => T) => factory }),
	}),
}))
vi.mock('void/env', () => ({
	env: {
		VITE_APP_URL: 'https://public.example.test/app',
		get APP_URL() {
			throw new Error('Server configuration must not be read in the browser')
		},
	},
}))

describe('browser public URLs', () => {
	it('uses only VITE_APP_URL without reading APP_URL or the browser request host', () => {
		expect(site.origin).toBe('https://public.example.test')
		expect(publicUrl('/blog')).toBe('https://public.example.test/blog')
	})
})
