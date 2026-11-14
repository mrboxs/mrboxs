// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitHubContributions } from '#/components/portfolio/github-contributions'
import { githubContributionsQuery } from '#/data/github-contributions'
import { parseGitHubContributions } from '#/lib/github-contributions'

import { actAndFlush } from '../../helpers/react'

vi.mock('#/lib/github-contributions.functions', () => ({
	getGitHubContributions: vi.fn(),
}))

let root: Root
let container: HTMLDivElement
let client: QueryClient

function activity(...dates: Array<string>) {
	return parseGitHubContributions({
		contributions: dates.map((date) => ({ date, count: 0, level: 0 })),
	})
}

function cell(date: string) {
	const day = container.querySelector(`[data-contribution-day="${date}"]`)
	if (!day) throw new Error(`Missing contribution day: ${date}`)
	return day
}

function tabStops() {
	return Array.from(
		container.querySelectorAll('[data-contribution-day][tabindex="0"]'),
		(day) => day.getAttribute('data-contribution-day')
	)
}

beforeEach(async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	client = new QueryClient()
	client.setQueryData(
		githubContributionsQuery.queryKey,
		activity('2026-11-10', '2026-11-13')
	)
	await actAndFlush(() => {
		root.render(
			<QueryClientProvider client={client}>
				<GitHubContributions />
			</QueryClientProvider>
		)
	})
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	client.clear()
	container.remove()
	vi.unstubAllGlobals()
})

async function focusDay(date: string) {
	await actAndFlush(() => {
		cell(date).dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
	})
}

async function refresh(from: string, to: string) {
	await act(async () => {
		client.setQueryData(githubContributionsQuery.queryKey, activity(from, to))
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

it('starts with the latest displayed day as the only tab stop', () => {
	expect(tabStops()).toEqual(['2026-11-13'])
})

it('falls back to the latest day when a refresh removes the focused date', async () => {
	await focusDay('2026-11-10')
	expect(tabStops()).toEqual(['2026-11-10'])
	await refresh('2026-11-11', '2026-11-14')
	expect(
		container.querySelector('[data-contribution-day="2026-11-10"]')
	).toBeNull()
	expect(tabStops()).toEqual(['2026-11-14'])
})

it('preserves a focused day inserted by gap filling across a refresh', async () => {
	await focusDay('2026-11-11')
	expect(tabStops()).toEqual(['2026-11-11'])
	await refresh('2026-11-10', '2026-11-14')
	expect(tabStops()).toEqual(['2026-11-11'])
})
