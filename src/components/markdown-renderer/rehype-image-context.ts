import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

export function rehypeImageContext() {
	return (tree: Root) => {
		visit(tree, 'element', (node) => {
			// Heading text becomes a permalink, so its images must stay non-interactive too.
			if (node.tagName !== 'a' && !/^h[1-6]$/.test(node.tagName)) return
			visit(node, 'element', (child) => {
				if (child.tagName === 'img') {
					child.properties['data-no-image-dialog'] = true
				}
			})
		})
	}
}
