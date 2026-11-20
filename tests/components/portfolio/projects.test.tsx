// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import { createRoot, type Root } from 'react-dom/client'

import { Projects } from '#/components/portfolio/projects'
import { TooltipProvider } from '#/components/ui/tooltip'
import { projects, type Project } from '#/data/projects'

import { actAndFlush } from '../../helpers/react'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

async function render(items?: ReadonlyArray<Project>) {
	await actAndFlush(() =>
		root.render(
			<TooltipProvider>
				<Projects items={items} />
			</TooltipProvider>
		)
	)
}

function trigger(index = 0) {
	const button = [
		...container.querySelectorAll<HTMLButtonElement>('h3 button'),
	].at(index)
	if (!button) throw new Error('Missing project trigger')
	return button
}

it('shows the real repository and period, initially collapsed, and connects its disclosure content', async () => {
	await render()
	expect(container.querySelector('#projects-title')?.textContent).toBe(
		'Projects(1)'
	)
	expect(trigger().textContent).toBe('mrboxs')
	expect(trigger().getAttribute('aria-expanded')).toBe('false')
	expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
		'2026-11'
	)
	expect(container.querySelector('time')?.textContent).toBe('11.2026')
	expect(container.textContent).toContain('Present')
	expect(container.textContent).not.toContain(projects[0].description)
	expect(container.textContent).not.toContain('Show more')
	await actAndFlush(() => trigger().click())
	expect(trigger().getAttribute('aria-expanded')).toBe('true')
	const id = trigger().getAttribute('aria-controls')
	if (!id) throw new Error('Missing disclosure content id')
	expect(document.getElementById(id)?.textContent).toContain(
		projects[0].description
	)
	expect(
		[...container.querySelectorAll('[data-slot="badge"]')].map(
			(e) => e.textContent
		)
	).toEqual([...projects[0].skills])
	await actAndFlush(() => trigger().click())
	expect(trigger().getAttribute('aria-expanded')).toBe('false')
})

it('keeps repository navigation separate from expanding the project', async () => {
	await render()
	const link = container.querySelector<HTMLAnchorElement>('a')
	if (!link) throw new Error('Missing repository link')
	expect(link.getAttribute('href')).toBe('https://github.com/mrboxs/mrboxs')
	expect(link.getAttribute('target')).toBe('_blank')
	expect(link.getAttribute('rel')).toBe('noopener noreferrer')
	expect(link.getAttribute('role')).not.toBe('button')
	expect(link.getAttribute('aria-label')).toBe('Open mrboxs on GitHub')
	link.addEventListener('click', (event) => event.preventDefault(), {
		once: true,
	})
	await actAndFlush(() => link.click())
	expect(trigger().getAttribute('aria-expanded')).toBe('false')
})

it('reveals additional projects only when there are more than four and keeps row state independent', async () => {
	const items = Array.from({ length: 5 }, (_, index) => ({
		...projects[0],
		id: `project-${index}`,
		title: `Project ${index + 1}`,
	}))
	await render(items)
	expect(container.querySelector('sup')?.textContent).toBe('(5)')
	expect(container.querySelectorAll('h3')).toHaveLength(4)
	const more = [
		...container.querySelectorAll<HTMLButtonElement>('button'),
	].find((b) => b.textContent === 'Show more')
	if (!more) throw new Error('Missing show-more trigger')
	await actAndFlush(() => more.click())
	expect(more.getAttribute('aria-expanded')).toBe('true')
	expect(more.textContent).toBe('Show less')
	expect(container.querySelectorAll('h3')).toHaveLength(5)
	await actAndFlush(() => trigger(0).click())
	await actAndFlush(() => trigger(1).click())
	expect(trigger(0).getAttribute('aria-expanded')).toBe('true')
	expect(trigger(1).getAttribute('aria-expanded')).toBe('true')
	await actAndFlush(() => more.click())
	expect(more.getAttribute('aria-expanded')).toBe('false')
	expect(trigger(0).getAttribute('aria-expanded')).toBe('true')
})

it('handles empty data and displays an ended period without an ongoing marker', async () => {
	await render([])
	expect(container.querySelector('sup')?.textContent).toBe('(0)')
	expect(container.textContent).toContain('No projects yet.')
	expect(container.querySelector('button')).toBeNull()
	await render([
		{ ...projects[0], period: { start: '2026-11', end: '2026-12' } },
	])
	expect(
		[...container.querySelectorAll('time')].map((t) => t.textContent)
	).toEqual(['11.2026', '12.2026'])
	expect(container.textContent).not.toContain('Present')
})
