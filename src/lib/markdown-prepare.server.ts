import '@tanstack/react-start/server-only'
import type { Code } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { emptyPublicContent } from '#/constants/model'
import type { PreparedCodeBlock } from '#/constants/model'
import {
	CODE_BLOCK_SHIKI_LIGHT_THEME,
	CODE_BLOCK_SHIKI_THEME,
	bundledLanguages,
	getSingletonHighlighter,
} from '#/lib/shiki.bundle'
import type { BundledLanguage } from '#/lib/shiki.bundle'

const parser = unified().use(remarkParse).use(remarkGfm)
const themes = {
	light: CODE_BLOCK_SHIKI_LIGHT_THEME,
	dark: CODE_BLOCK_SHIKI_THEME,
} as const
// Highlighting is optional; large articles must remain readable on Workers.
const highlightCharacterBudget = 50_000

function isBundledLanguage(language: string): language is BundledLanguage {
	return Object.hasOwn(bundledLanguages, language)
}

async function highlight(block: PreparedCodeBlock) {
	if (!isBundledLanguage(block.language)) return block
	try {
		const highlighter = await getSingletonHighlighter({
			themes: Object.values(themes),
			langs: [block.language],
		})
		const tokens = highlighter.codeToTokensWithThemes(block.code, {
			lang: block.language,
			themes,
		})
		block.tokens = tokens.map((line) =>
			line.map((token) => ({
				content: token.content,
				light: token.variants.light,
				dark: token.variants.dark,
			}))
		)
		const light = highlighter.getTheme(themes.light)
		const dark = highlighter.getTheme(themes.dark)
		block.colors = {
			light: { color: light.fg, bgColor: light.bg },
			dark: { color: dark.fg, bgColor: dark.bg },
		}
	} catch {
		// A missing grammar or tokenization timeout must not hide the article.
	}
	return block
}

export async function prepareMarkdown(content: string) {
	const result = emptyPublicContent()
	const code: Array<Code> = []
	visit(parser.parse(content), 'code', (node) => {
		code.push(node)
	})
	let remainingCharacters = highlightCharacterBudget
	const toHighlight: Array<PreparedCodeBlock> = []
	for (const node of code) {
		const offset = node.position?.start.offset
		if (offset === undefined) continue
		const block = {
			code: node.value,
			language: node.lang?.toLowerCase() ?? 'text',
		}
		result.codeBlocks[offset] = block
		if (
			isBundledLanguage(block.language) &&
			block.code.length <= remainingCharacters
		) {
			remainingCharacters -= block.code.length
			toHighlight.push(block)
		}
	}
	let nextBlock = 0
	function highlightNext(): Promise<void> {
		const block = toHighlight.at(nextBlock++)
		return block ? highlight(block).then(highlightNext) : Promise.resolve()
	}
	// Overlap grammar loading without starting every block at once.
	await Promise.all([highlightNext(), highlightNext()])
	return result
}
