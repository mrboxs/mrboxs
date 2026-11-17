import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const calloutMarker =
	/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/

export const remarkCallouts: Plugin<[], Root> = () => (tree, file) => {
	const source = file.toString()
	visit(tree, 'blockquote', (node) => {
		const paragraph = node.children.at(0)
		if (paragraph?.type !== 'paragraph') return
		const first = paragraph.children.at(0)
		if (first?.type !== 'text') return
		const offset = first.position?.start.offset
		if (offset === undefined) return
		const match = calloutMarker.exec(source.slice(offset))
		if (!match) return
		first.value = first.value.replace(calloutMarker, '')
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
