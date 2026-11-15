import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { prepareMarkdown } from '#/lib/markdown-prepare.server'
import * as shiki from '#/lib/shiki.bundle'

afterEach(() => vi.restoreAllMocks())

describe('server Markdown preparation', () => {
	it('preserves unknown, unlabelled, indented and nested code at source offsets', async () => {
		const content =
			'```unknown\nraw <tag>\n```\n\n    indented\n\n> ```\n> nested\n> ```'
		const result = await prepareMarkdown(content)
		expect(result).toEqual({
			codeBlocks: {
				0: { code: 'raw <tag>', language: 'unknown' },
				[content.indexOf('    indented')]: {
					code: 'indented',
					language: 'text',
				},
				[content.indexOf('```', content.indexOf('\n>'))]: {
					code: 'nested',
					language: 'text',
				},
			},
		})
	})
	it('highlights both themes, normalizes aliases, and preserves source whitespace', async () => {
		const code = '\tconst value = render("<script>");  \n\n'
		const themes = {
			light: shiki.CODE_BLOCK_SHIKI_LIGHT_THEME,
			dark: shiki.CODE_BLOCK_SHIKI_THEME,
		} as const
		const highlighter = await shiki.getSingletonHighlighter({
			themes: Object.values(themes),
			langs: ['ts'],
		})
		// Warm the regex compiler without Shiki's cold-start time limit.
		highlighter.codeToTokensWithThemes(code, {
			lang: 'ts',
			themes,
			tokenizeTimeLimit: 0,
		})
		const content = `Intro\n\n\`\`\`TS\n${code}\n\`\`\``
		const result = await prepareMarkdown(content)
		const block = result.codeBlocks[content.indexOf('```')]
		expect(block.code).toBe(code)
		expect(block.language).toBe('ts')
		expect(
			block.tokens
				?.map((line) => line.map((token) => token.content).join(''))
				.join('\n')
		).toBe(code)
		expect(
			block.tokens
				?.flat()
				.some((token) => token.light.color !== token.dark.color)
		).toBe(true)
		expect(
			block.tokens?.flat().find((token) => token.content.includes('render'))
		).toMatchObject({ light: { fontStyle: 2 }, dark: { fontStyle: 2 } })
		expect(block.colors?.light.color).toBeTruthy()
		expect(block.colors?.dark.color).toBeTruthy()
		expect(JSON.parse(JSON.stringify(result))).toEqual(result)
	})
	it('falls back to plain code when highlighting fails', async () => {
		vi.spyOn(shiki, 'getSingletonHighlighter').mockRejectedValue(
			new Error('Grammar unavailable')
		)
		expect(await prepareMarkdown('```js\nconst x = 1\n```')).toEqual({
			codeBlocks: { 0: { code: 'const x = 1', language: 'js' } },
		})
	})
	it('skips highlighting large blocks without loading a grammar or dropping source', async () => {
		const highlighter = vi.spyOn(shiki, 'getSingletonHighlighter')
		const code = 'x'.repeat(50_001)
		expect(
			(await prepareMarkdown(`\`\`\`js\n${code}\n\`\`\``)).codeBlocks[0]
		).toEqual({ code, language: 'js' })
		expect(highlighter).not.toHaveBeenCalled()
	})
	it('does not resolve project or collection mentions', async () => {
		expect(
			await prepareMarkdown(
				'[Project](/project) [Collection](/collections/tools)'
			)
		).toEqual({ codeBlocks: {} })
	})
})
