import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

export const remarkCallouts: Plugin<[], Root> = () => (tree, file) => {
	const source = file.toString()
	visit(tree, 'blockquote', (node) => {
		const paragraph = node.children.at(0)
		if (paragraph?.type !== 'paragraph') return
		const first = paragraph.children.at(0)
		if (first?.type !== 'text') return
		const match =
			/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/.exec(
				first.value
			)
		if (!match) return
		const offset = first.position?.start.offset
		// Escaped or entity-encoded markers are ordinary quoted text.
		if (offset === undefined || !source.startsWith(`[!${match[1]}]`, offset)) {
			return
		}
		first.value = first.value.slice(match[0].length)
		if (!first.value) paragraph.children.shift()
		if (paragraph.children.length === 0) node.children.shift()
		node.data = {
			...node.data,
			hProperties: {
				...node.data?.hProperties,
				'data-callout': match[1].toLowerCase(),
			},
		}
	})
}
