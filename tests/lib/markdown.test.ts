import { describe, expect, it } from 'vite-plus/test'

import { articleHeadings } from '#/constants/headings'
import { contentLink } from '#/constants/model'

describe('blog Markdown links', () => {
	it.each([
		['next?ref=blog#setup', '/blog/next'],
		['./next', '/blog/next'],
		['?ref=blog', '/blog/current'],
		['/blog/next', '/blog/next'],
		['../about', '/about'],
	])('resolves %s from the blog URL', (href, pathname) => {
		const target = contentLink(href, 'current', 'https://preview.test')
		expect(target?.internal).toBe(true)
		expect(target?.url.pathname).toBe(pathname)
	})
	it('preserves search and hash and checks the complete origin', () => {
		const target = contentLink(
			'next?ref=blog#setup',
			'current',
			'https://preview.test'
		)
		expect(target?.url.search).toBe('?ref=blog')
		expect(target?.url.hash).toBe('#setup')
		for (const href of [
			'https://preview.test.evil.test',
			'http://preview.test',
			'https://preview.test:8443',
			'https://user:pass@preview.test',
		]) {
			expect(
				contentLink(href, 'current', 'https://preview.test')?.internal
			).toBe(false)
		}
	})
	it.each([
		'#setup',
		'',
		'mailto:me@example.test',
		'javascript:alert(1)',
		'data:text/html,test',
	])('leaves %s outside web navigation', (href) => {
		expect(contentLink(href, 'current', 'https://preview.test')).toBeNull()
	})
})

describe('article headings', () => {
	it('uses readable unique IDs including suffix collisions, Unicode and empty text', () => {
		expect(
			articleHeadings(
				'## Setup\n## Setup\n## Setup-1\n## Setup\n## Café 世界\n## !!!'
			).map(({ id }) => id)
		).toEqual([
			'setup',
			'setup-1',
			'setup-1-1',
			'setup-2',
			'cafe-世界',
			'section',
		])
	})
	it('keeps an anchor stable when an unrelated heading is inserted', () => {
		expect(articleHeadings('## Earlier\n## Setup')[1].id).toBe(
			articleHeadings('## Setup')[0].id
		)
	})
	it('extracts inline formatting and image alt text, and limits the outline to h2/h3', () => {
		expect(
			articleHeadings(
				'# A `code` *heading*\n## [Link](/blog) ![Diagram](a.png)\n### Third\n#### Fourth'
			)
		).toEqual([
			{ id: 'a-code-heading', title: 'A code heading', depth: 2 },
			{ id: 'link-diagram', title: 'Link Diagram', depth: 2 },
			{ id: 'third', title: 'Third', depth: 3 },
		])
	})
})
