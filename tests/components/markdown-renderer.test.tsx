// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterContextProvider,
} from '@tanstack/react-router'

import { act } from 'react'
import type { ComponentProps } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import favicon from '#/assets/mrboxs-symbol.svg?url'
import { MarkdownRenderer } from '#/components/markdown-renderer'
import { articleHeadings } from '#/constants/headings'
import type { PreparedPublicContent } from '#/constants/model'

import { blogPost } from '../helpers/blog'
import { actAndFlush } from '../helpers/react'

let root: Root | undefined
let container: HTMLDivElement
let router: ReturnType<typeof createRouter>

beforeEach(async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	container = document.createElement('div')
	document.body.appendChild(container)
	const rootRoute = createRootRoute()
	const postRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/blog/$slug',
	})
	router = createRouter({
		routeTree: rootRoute.addChildren([postRoute]),
		history: createMemoryHistory({
			initialEntries: ['/blog/tulisan-pertama?ref=reader'],
		}),
		origin: 'https://preview.example.test',
	})
	await router.load()
})

afterEach(async () => {
	await actAndFlush(() => root?.unmount())
	root = undefined
	router.history.destroy()
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

function view(
	content: string,
	props: Partial<ComponentProps<typeof MarkdownRenderer>> = {}
) {
	return (
		<RouterContextProvider router={router}>
			<MarkdownRenderer
				slug={blogPost.slug}
				content={content}
				assets={blogPost.assets}
				{...props}
			/>
		</RouterContextProvider>
	)
}

async function render(
	content: string,
	props: Partial<ComponentProps<typeof MarkdownRenderer>> = {}
) {
	root ??= createRoot(container)
	await actAndFlush(() => root?.render(view(content, props)))
}

function find<T extends Element>(selector: string): T {
	const element = container.querySelector<T>(selector)
	if (!element) throw new Error(`Missing ${selector}`)
	return element
}

describe('blog Markdown renderer', () => {
	it('renders GFM and escapes code while dropping HTML, MDX and unsafe URLs', async () => {
		await render(
			'# Title\n\n~~old~~ and `inline`\n\n- [x] Done\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<Component />\n\n[bad](javascript:alert(1))\n\n![bad](data:text/html,test)\n\n```html\n<script>alert(2)</script>\n```'
		)
		expect(find('h2').textContent).toBe('Title')
		expect(find('del').textContent).toBe('old')
		expect(find<HTMLInputElement>('input[type="checkbox"]').checked).toBe(true)
		expect(find<HTMLInputElement>('input[type="checkbox"]').disabled).toBe(true)
		expect(find('table').textContent).toContain('Name')
		expect(find('pre code').textContent).toBe('<script>alert(2)</script>')
		expect(
			container.querySelector(
				'h1, script, component, [onerror], a[href^="javascript:"], img[src^="data:"]'
			)
		).toBeNull()
		expect(container.textContent).toContain('Image unavailable: bad')
	})

	it('resolves internal links from the current origin and blog path without mention chips', async () => {
		await render(
			'[relative](next?ref=blog#setup) [same](https://preview.example.test/blog/next) [external](https://example.com) [email](mailto:me@example.com) [fragment](#setup) [collection](/collections/tools)'
		)
		expect(find('a[href="/blog/next?ref=blog#setup"]').textContent).toBe(
			'relative'
		)
		expect(
			find<HTMLImageElement>('a[href="/blog/next"] img').getAttribute('src')
		).toBe(favicon)
		const external = find<HTMLAnchorElement>('a[href="https://example.com/"]')
		expect(external.target).toBe('_blank')
		expect(external.rel).toBe('noopener noreferrer')
		expect(external.textContent).toContain('opens in a new tab')
		expect(find<HTMLAnchorElement>('a[href^="mailto:"]').target).toBe('')
		expect(find('a[href="#setup"]').textContent).toBe('fragment')
		expect(find('a[href="/collections/tools"]').textContent).toBe('collection')
		expect(
			container.querySelector(
				'[data-project-mention], [data-collection-mention]'
			)
		).toBeNull()
		await act(async () => {
			find<HTMLAnchorElement>('a[href="/blog/next?ref=blog#setup"]').click()
			await router.load()
		})
		expect(router.state.location.pathname).toBe('/blog/next')
		expect(router.state.location.search).toEqual({ ref: 'blog' })
		expect(router.state.location.hash).toBe('setup')
	})

	it('uses the public asset endpoint for inline, reference and linked images', async () => {
		await render(
			'![Inline](./cover.png) ![Reference][cover]\n\n[![Badge](./cover.png)](./cover.png)\n\n![Remote](https://images.example.test/cover.png)\n\n![Missing](./missing.png) ![Traversal](../cover.png)\n\n[cover]: cover.png'
		)
		const images = container.querySelectorAll(
			'img[src="/api/blog/assets/tulisan-pertama/cover.png"]'
		)
		expect(images).toHaveLength(3)
		const link = find<HTMLAnchorElement>(
			'a[href="/api/blog/assets/tulisan-pertama/cover.png"]'
		)
		expect(link.querySelectorAll('img')).toHaveLength(1)
		expect(link.querySelector('svg')).toBeNull()
		expect(link.querySelector('button')).toBeNull()
		expect(find<HTMLImageElement>('img[alt="Remote"]').src).toBe(
			'https://images.example.test/cover.png'
		)
		expect(container.textContent).toContain('Image unavailable: Missing')
		expect(container.textContent).toContain('Image unavailable: Traversal')
		await actAndFlush(() => images[0].dispatchEvent(new Event('error')))
		expect(container.querySelector('img[alt="Inline"]')).toBeNull()
		expect(container.textContent).toContain('Image unavailable: Inline')
	})
	it.each([
		'./images/diagram.svg#detail',
		'./images/diagram.svg?raw=1',
		'./images/diagram.svg?raw=1#detail',
		'./images/diagram.svg?label=a%20b#detail',
	])(
		'preserves the query and fragment on inventoried assets: %s',
		async (reference) => {
			await render(`![Diagram](${reference})\n\n[Open diagram](${reference})`, {
				assets: {
					'images/diagram.svg': {
						commit: blogPost.cover.src.commit,
						path: `posts/${blogPost.slug}/images/diagram.svg`,
					},
				},
			})
			const expected = reference.replace(
				'./',
				`/api/blog/assets/${blogPost.slug}/`
			)
			expect(find('img[alt="Diagram"]').getAttribute('src')).toBe(expected)
			expect(find('a').getAttribute('href')).toBe(expected)
		}
	)

	it.each([
		'/blog/tulisan-pertama.md?download=1#content',
		'tulisan-pertama.md?download=1#content',
		'https://preview.example.test/blog/tulisan-pertama.md?download=1#content',
	])(
		'requests Markdown links as documents without router interception: %s',
		async (href) => {
			await render(`[Markdown](${href})`)
			const link = find<HTMLAnchorElement>('a')
			expect(link.getAttribute('href')).toBe(
				'/blog/tulisan-pertama.md?download=1#content'
			)
			const navigate = vi.spyOn(router, 'navigate')
			const event = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				button: 0,
			})
			await actAndFlush(() => link.dispatchEvent(event))
			expect(event.defaultPrevented).toBe(false)
			expect(navigate).not.toHaveBeenCalled()
		}
	)

	it('uses shadcn tables without losing alignment, cell formatting or keyboard access', async () => {
		await render(
			'| Left | Center | Right |\n| :--- | :---: | ---: |\n| **Bold** | `code` | [Link](https://example.com) |'
		)
		const scroll = find<HTMLElement>('[role="region"][aria-label="Table"]')
		expect(scroll.tabIndex).toBe(0)
		expect(find('table').getAttribute('data-slot')).toBe('table')
		expect(
			[...container.querySelectorAll('th')].map((cell) => cell.style.textAlign)
		).toEqual(['left', 'center', 'right'])
		expect(
			[...container.querySelectorAll('td')].map((cell) => cell.style.textAlign)
		).toEqual(['left', 'center', 'right'])
		expect(
			[...container.querySelectorAll('th')].every(
				(cell) => cell.scope === 'col'
			)
		).toBe(true)
		expect(find('td strong').textContent).toBe('Bold')
		expect(find('td code').textContent).toBe('code')
		expect(find('td a').getAttribute('href')).toBe('https://example.com/')
		expect(container.querySelector('[node]')).toBeNull()
	})

	it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])(
		'renders a %s callout as a named shadcn Alert and preserves Markdown content',
		async (type) => {
			await render(
				`> [!${type}]\n> **Keep** [the link](https://example.com).\n>\n> - First\n> - Second`
			)
			const callout = find('[data-slot="alert"]')
			expect(callout.getAttribute('role')).toBe('note')
			expect(callout.getAttribute('aria-label')?.toUpperCase()).toBe(type)
			expect(callout.getAttribute('data-callout')).toBe(type.toLowerCase())
			expect(
				callout
					.querySelector('[data-slot="alert-title"]')
					?.textContent.toUpperCase()
			).toBe(type)
			expect(callout.textContent).not.toContain(`[!${type}]`)
			expect(callout.querySelector('strong')?.textContent).toBe('Keep')
			expect(callout.querySelector('a')?.href).toBe('https://example.com/')
			expect(callout.querySelectorAll('li')).toHaveLength(2)
			expect(callout.querySelector('p p, p div')).toBeNull()
		}
	)

	it.each([
		'> Ordinary **quote**.',
		'> [!UNKNOWN]\n> Ordinary quote.',
		'> Text before [!NOTE].',
		'> [!NOTE] on the same line.',
		'> [!NOTE] **Quoted text**',
		'> [!NOTE] *Quoted text*',
		'> [!NOTE] [Quoted link](https://example.com)',
		'> [!NOTE] `Quoted code`',
		'> `[!NOTE]`\n> Quoted code.',
		'> \\[!NOTE]\n> Escaped marker.',
		'> &#91;!NOTE]\n> Entity marker.',
	])(
		'keeps ordinary or literal quoted markers as a blockquote: %s',
		async (content) => {
			await render(content)
			expect(container.querySelector('blockquote')).not.toBeNull()
			expect(container.querySelector('[data-slot="alert"]')).toBeNull()
		}
	)

	it('handles empty, nested and separate-paragraph callouts without swallowing adjacent content', async () => {
		await render(
			'> [!NOTE]\n\nBetween.\n\n> [!TIP]\n>\n> Paragraph.\n>\n> > [!WARNING]\n> > Nested.\n\nAfter.\n\n```md\n> [!NOTE]\n```'
		)
		expect(container.querySelectorAll('[data-slot="alert"]')).toHaveLength(3)
		expect(
			find(
				'[data-callout="note"] [data-slot="alert-description"]'
			).textContent.trim()
		).toBe('')
		expect(
			find('[data-callout="tip"] [data-callout="warning"]').textContent
		).toContain('Nested.')
		expect(container.textContent).toContain('Between.')
		expect(container.textContent).toContain('After.')
		expect(find('pre code').textContent).toBe('> [!NOTE]')
	})

	it('opens a single-image lightbox, labels it, and restores focus after Escape', async () => {
		await render('![Cover](./cover.png "Cover title")')
		const trigger = find<HTMLButtonElement>(
			'button[aria-label="Enlarge image: Cover title"]'
		)
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		await actAndFlush(() => {
			trigger.focus()
			trigger.click()
		})
		const dialog = document.querySelector('[role="dialog"]')
		if (!dialog) throw new Error('Missing image dialog')
		expect(dialog.getAttribute('aria-label')).toBe('Cover title')
		expect(dialog.querySelectorAll('[data-slot="lightbox-item"]')).toHaveLength(
			1
		)
		expect(
			dialog.querySelector('[data-slot="lightbox-caption"]')?.textContent
		).toBe('Cover title')
		expect(
			dialog.querySelector(
				'[data-slot="lightbox-previous"], [data-slot="lightbox-next"], [data-slot="lightbox-counter"]'
			)
		).toBeNull()
		expect(dialog.querySelector('img')?.getAttribute('src')).toBe(
			'/api/blog/assets/tulisan-pertama/cover.png'
		)
		expect(dialog.contains(document.activeElement)).toBe(true)
		await actAndFlush(() =>
			document.activeElement?.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					code: 'Escape',
					bubbles: true,
				})
			)
		)
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(document.activeElement).toBe(trigger)
	})

	it('zooms with the mouse wheel without holding Control and keeps zoom controls usable', async () => {
		await render('![Cover](./cover.png)')
		await actAndFlush(() =>
			find<HTMLButtonElement>('[data-slot="lightbox-trigger"]').click()
		)
		await act(async () => {
			await vi.dynamicImportSettled()
		})
		const zoom = document.querySelector('[data-slot="lightbox-zoom"]')
		const zoomOut = document.querySelector<HTMLButtonElement>(
			'[data-slot="lightbox-zoom-out"]'
		)
		const zoomIn = document.querySelector<HTMLButtonElement>(
			'[data-slot="lightbox-zoom-in"]'
		)
		if (!zoom || !zoomOut || !zoomIn) throw new Error('Missing zoom controls')
		expect(zoomOut.disabled).toBe(true)
		const wheel = new WheelEvent('wheel', {
			deltaY: -100,
			bubbles: true,
			cancelable: true,
		})
		await actAndFlush(() => zoom.dispatchEvent(wheel))
		expect(wheel.defaultPrevented).toBe(true)
		expect(zoom.hasAttribute('data-zoom')).toBe(true)
		expect(zoomOut.disabled).toBe(false)
		await actAndFlush(() => zoomOut.click())
		await act(async () => {
			await Promise.all(
				[zoom, ...zoom.querySelectorAll('*')].flatMap((element) =>
					element.getAnimations().map((animation) => animation.finished)
				)
			)
		})
		await vi.waitFor(() => expect(zoom.hasAttribute('data-zoom')).toBe(false))
		await actAndFlush(() => zoomIn.click())
		await act(async () => {
			await Promise.all(
				[zoom, ...zoom.querySelectorAll('*')].flatMap((element) =>
					element.getAnimations().map((animation) => animation.finished)
				)
			)
		})
		await vi.waitFor(() => expect(zoom.hasAttribute('data-zoom')).toBe(true))
	})

	it('keeps the lightbox closable on image failure and retries on reopening', async () => {
		await render('![Cover](./cover.png)')
		const trigger = find<HTMLButtonElement>(
			'button[aria-label="Enlarge image: Cover"]'
		)
		await actAndFlush(() => trigger.click())
		const dialog = document.querySelector('[role="dialog"]')
		if (!dialog) throw new Error('Missing image dialog')
		await actAndFlush(() =>
			dialog.querySelector('img')?.dispatchEvent(new Event('error'))
		)
		expect(dialog.querySelector('output')?.textContent).toBe(
			'Image unavailable: Cover'
		)
		const close = dialog.querySelector<HTMLButtonElement>(
			'[data-slot="lightbox-close"]'
		)
		if (!close) throw new Error('Missing close button')
		await actAndFlush(() => close.click())
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(container.querySelector('img[alt="Cover"]')).not.toBeNull()
		await actAndFlush(() => trigger.click())
		expect(document.querySelector('[role="dialog"] img')).not.toBeNull()
	})

	it('does not nest preview buttons in linked images or heading permalinks', async () => {
		await render(
			'[![Linked](./cover.png)](https://example.com)\n\n## *![Heading](./cover.png)*\n\n![Standalone](./cover.png)'
		)
		expect(container.querySelector('a button, button button')).toBeNull()
		expect(
			container.querySelectorAll('[data-slot="lightbox-trigger"]')
		).toHaveLength(1)
		expect(
			find('button[aria-label="Enlarge image: Standalone"] img').getAttribute(
				'alt'
			)
		).toBe('Standalone')
		expect(find('a[href="https://example.com/"] img').getAttribute('alt')).toBe(
			'Linked'
		)
	})

	it('preserves referenced image links without turning them into preview buttons', async () => {
		await render(
			'[*![Reference][image]*][destination]\n\n[image]: ./cover.png\n[destination]: /blog/next'
		)
		expect(find('a[href="/blog/next"] img').getAttribute('src')).toBe(
			'/api/blog/assets/tulisan-pertama/cover.png'
		)
		expect(
			container.querySelector('a button, [data-slot="lightbox-trigger"]')
		).toBeNull()
	})

	it('provides a nonempty lightbox name even when the image title and alt are blank', async () => {
		await render('![](./cover.png "")')
		const trigger = find<HTMLButtonElement>(
			'button[aria-label="Enlarge image: Article image"]'
		)
		await actAndFlush(() => trigger.click())
		expect(
			document
				.querySelector('[data-slot="lightbox-content"]')
				?.getAttribute('aria-label')
		).toBe('Article image')
	})

	it('dismisses an open preview when the article image changes', async () => {
		await render('![First](https://images.example.test/first.png)')
		await actAndFlush(() =>
			find<HTMLButtonElement>('[data-slot="lightbox-trigger"]').click()
		)
		expect(document.querySelector('[role="dialog"]')).not.toBeNull()
		await render('![Second](https://images.example.test/second.png)')
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(
			find('button[aria-label="Enlarge image: Second"] img').getAttribute('src')
		).toBe('https://images.example.test/second.png')
	})

	it('keeps source offsets and URL/HTML safety inside callouts', async () => {
		const content =
			'> [!NOTE]\n> [unsafe](javascript:alert(1))\n>\n> ```ts\n> const value = 1\n> ```\n>\n> <script>alert(1)</script>'
		const prepared: PreparedPublicContent = {
			codeBlocks: {
				[content.indexOf('```')]: {
					code: 'const value = 1',
					language: 'ts',
					tokens: [
						[
							{
								content: 'const value = 1',
								light: { color: '#123456' },
								dark: { color: '#abcdef' },
							},
						],
					],
				},
			},
		}
		await render(content, { prepared })
		expect(find('[data-slot="alert"] .public-code-token').textContent).toBe(
			'const value = 1'
		)
		expect(container.querySelector('script, a[href^="javascript:"]')).toBeNull()
	})

	it('recovers image errors and keeps the failure fallback across parent rerenders', async () => {
		await render('![Broken](https://images.example.test/broken.png)')
		await actAndFlush(() => find('img').dispatchEvent(new Event('error')))
		await render('![Broken](https://images.example.test/broken.png)')
		expect(container.querySelector('img')).toBeNull()
		await render('![Fixed](https://images.example.test/fixed.png)')
		expect(find<HTMLImageElement>('img[alt="Fixed"]').src).toBe(
			'https://images.example.test/fixed.png'
		)
	})

	it('resolves escaped asset names without allowing encoded traversal', async () => {
		const assets = {
			'images/café cover.png': {
				commit: 'a'.repeat(40),
				path: `posts/${blogPost.slug}/images/café cover.png`,
			},
		}
		await render(
			'![Cover](<./images/café cover.png>)\n\n[Open](<./images/café cover.png>)\n\n![Escape](%2e%2e/images/caf%C3%A9%20cover.png?raw=1#detail)\n\n![Double](images/caf%25C3%25A9%2520cover.png#detail)',
			{ assets }
		)
		expect(find<HTMLImageElement>('img[alt="Cover"]').getAttribute('src')).toBe(
			'/api/blog/assets/tulisan-pertama/images/caf%C3%A9%20cover.png'
		)
		expect(
			find(
				'a[href="/api/blog/assets/tulisan-pertama/images/caf%C3%A9%20cover.png"]'
			).textContent
		).toBe('Open')
		expect(container.textContent).toContain('Image unavailable: Escape')
		expect(container.textContent).toContain('Image unavailable: Double')
	})

	it('preserves the IDs, labels and backlinks emitted for GFM footnotes', async () => {
		await render('A note[^one].\n\n[^one]: Footnote content.')
		const reference = find<HTMLAnchorElement>('a[data-footnote-ref]')
		const backlink = find<HTMLAnchorElement>('a[data-footnote-backref]')
		expect(reference.id).toBe('user-content-fnref-one')
		expect(reference.getAttribute('aria-describedby')).toBe('footnote-label')
		expect(backlink.hash).toBe(`#${reference.id}`)
		expect(backlink.getAttribute('aria-label')).toContain('Back to reference')
		expect(find(reference.hash).textContent).toContain('Footnote content.')
	})

	it('handles an image that failed to load before hydration', async () => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
			true
		)
		vi.spyOn(HTMLImageElement.prototype, 'decode').mockRejectedValue(
			new Error('cached failure')
		)
		await render('![Broken](https://images.example.test/broken.png)')
		expect(container.querySelector('img')).toBeNull()
		expect(container.textContent).toContain('Image unavailable: Broken')
	})

	it('matches heading IDs to the outline and avoids nested links in formatted headings', async () => {
		const content =
			'# Intro\n\n## *Read [docs](https://example.com)* and `code`\n\n## Intro\n\n## ![Diagram](./cover.png)'
		await render(content)
		expect(
			[...container.querySelectorAll('h2, h3')].map((heading) => heading.id)
		).toEqual(articleHeadings(content).map(({ id }) => id))
		expect(container.querySelector('a a')).toBeNull()
		expect(find('a[aria-label="Link to Diagram"]').getAttribute('href')).toBe(
			'/blog/tulisan-pertama?ref=reader#diagram'
		)
	})

	it.each([true, false])(
		'scrolls and focuses a heading with reduced motion=%s while preserving search',
		async (reducedMotion) => {
			vi.spyOn(window, 'matchMedia').mockImplementation(
				() => ({ matches: reducedMotion }) as MediaQueryList
			)
			await render('## Setup')
			const heading = find<HTMLElement>('h2')
			const scroll = vi
				.spyOn(heading, 'scrollIntoView')
				.mockImplementation(() => undefined)
			await act(async () => {
				find<HTMLAnchorElement>('a[aria-label="Link to Setup"]').click()
				await router.load()
			})
			expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
			expect(router.state.location.search).toEqual({ ref: 'reader' })
			expect(router.state.location.hash).toBe('setup')
			expect(scroll).toHaveBeenCalledWith({
				block: 'start',
				behavior: reducedMotion ? 'instant' : 'smooth',
			})
			expect(document.activeElement).toBe(heading)
		}
	)

	it('copies whitespace exactly, announces failure, and keeps word wrap across rerenders', async () => {
		const code = '\tline  \n\n'
		const content = `\`\`\`unknown\n${code}\n\`\`\``
		const writeText = vi.fn().mockResolvedValue(undefined)
		vi.stubGlobal('navigator', { clipboard: { writeText } })
		await render(content)
		expect(find('pre code').textContent).toBe(code)
		await actAndFlush(() =>
			find<HTMLButtonElement>('button[aria-label="Word wrap"]').click()
		)
		expect(find('pre').classList.contains('whitespace-pre-wrap')).toBe(true)
		expect(
			find('button[aria-label="Word wrap"]').getAttribute('aria-pressed')
		).toBe('true')
		await actAndFlush(() =>
			find<HTMLButtonElement>('button[aria-label="Copy code"]').click()
		)
		expect(writeText).toHaveBeenCalledExactlyOnceWith(code)
		expect(find('output').textContent).toBe('Code copied to clipboard.')
		await render(content)
		expect(find('pre').classList.contains('whitespace-pre-wrap')).toBe(true)
		expect(find('output').textContent).toBe('Code copied to clipboard.')
		writeText.mockRejectedValueOnce(new Error('denied'))
		await actAndFlush(() =>
			find<HTMLButtonElement>('button[aria-label="Copy code"]').click()
		)
		expect(find('output').textContent).toContain('Unable to copy code.')
	})

	it('ignores stale prepared blocks rather than replacing the Markdown source', async () => {
		const prepared: PreparedPublicContent = {
			codeBlocks: {
				0: {
					code: 'old',
					language: 'js',
					tokens: [[{ content: 'old', light: {}, dark: {} }]],
				},
			},
		}
		await render('```js\nnew\n```', { prepared })
		expect(find('pre code').textContent).toBe('new')
	})

	it('ignores an older clipboard result after a newer copy attempt finishes', async () => {
		let finishFirst!: () => void
		const first = new Promise<void>((resolve) => {
			finishFirst = resolve
		})
		const writeText = vi
			.fn()
			.mockReturnValueOnce(first)
			.mockRejectedValueOnce(new Error('denied'))
		vi.stubGlobal('navigator', { clipboard: { writeText } })
		await render('```\ncode\n```')
		await actAndFlush(() =>
			find<HTMLButtonElement>('button[aria-label="Copy code"]').click()
		)
		await actAndFlush(() =>
			find<HTMLButtonElement>('button[aria-label="Copy code"]').click()
		)
		expect(find('output').textContent).toContain('Unable to copy code.')
		await actAndFlush(finishFirst)
		expect(find('output').textContent).toContain('Unable to copy code.')
	})

	it('includes both token palettes in SSR and hydrates without recovering markup', async () => {
		const content =
			'```TS\nconst value = 1\n```\n\n[internal](/blog)\n\n![Cover](./cover.png)\n\n> [!NOTE]\n> **SSR callout**\n\n| Left | Right |\n| :--- | ---: |\n| A | B |'
		const prepared: PreparedPublicContent = {
			codeBlocks: {
				0: {
					code: 'const value = 1',
					language: 'ts',
					tokens: [
						[
							{
								content: 'const value = 1',
								light: { color: '#123456', fontStyle: 2 },
								dark: { color: '#abcdef', fontStyle: 1 },
							},
						],
					],
				},
			},
		}
		const props = { prepared }
		const html = renderToString(view(content, props))
		expect(html).toContain('--code-light-color:#123456')
		expect(html).toContain('--code-dark-color:#abcdef')
		expect(html).toContain('/api/blog/assets/tulisan-pertama/cover.png')
		expect(html).toContain('data-slot="alert"')
		expect(html).toContain('data-slot="table"')
		expect(html).toContain('data-slot="lightbox-trigger"')
		container.innerHTML = html
		const recoverable = vi.fn()
		await act(async () => {
			root = hydrateRoot(container, view(content, props), {
				onRecoverableError: recoverable,
			})
			await Promise.resolve()
		})
		expect(recoverable).not.toHaveBeenCalled()
		expect(find('pre code').textContent).toBe('const value = 1')
	})
})
