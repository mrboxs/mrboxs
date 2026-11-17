import { useMemo } from 'react'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'

import type { ElementContent } from 'hast'
import remarkGfm from 'remark-gfm'

import { ContentBlockquote } from '#/components/markdown-renderer/callout'
import { MarkdownCodeBlock } from '#/components/markdown-renderer/code-block'
import { ContentLink } from '#/components/markdown-renderer/content-link'
import { ContentHeading } from '#/components/markdown-renderer/heading'
import { ContentImage } from '#/components/markdown-renderer/image'
import { rehypeImageContext } from '#/components/markdown-renderer/rehype-image-context'
import { remarkCallouts } from '#/components/markdown-renderer/remark-callouts'
import { markdownTableComponents } from '#/components/markdown-renderer/table'
import { remarkArticleHeadings } from '#/constants/headings'
import { emptyPublicContent } from '#/constants/model'
import type { PreparedPublicContent } from '#/constants/model'
import type { BlogPost } from '#/lib/blog'

function textContent(node: ElementContent): string {
	if (node.type === 'text') return node.value
	if (node.type === 'element' && node.tagName === 'img') {
		return String(node.properties.alt ?? '')
	}
	return node.type === 'element' ? node.children.map(textContent).join('') : ''
}

const emptyPrepared = emptyPublicContent()
const emptyAssets: BlogPost['assets'] = {}

export function MarkdownRenderer({
	slug,
	content,
	prepared = emptyPrepared,
	assets = emptyAssets,
}: {
	slug: string
	content: string
	prepared?: PreparedPublicContent
	assets?: BlogPost['assets']
}) {
	// React treats replacement renderers as component types; keep them stable on rerenders.
	const components = useMemo<Components>(
		() => ({
			img: ({ node, src, alt, title }) => (
				<ContentImage
					src={src}
					alt={alt}
					title={title}
					assets={assets}
					preview={node?.properties['data-no-image-dialog'] !== true}
				/>
			),
			h1: ({ node, children, ...props }) => (
				<ContentHeading
					as="h2"
					label={node ? textContent(node) : ''}
					{...props}
				>
					{children}
				</ContentHeading>
			),
			h2: ({ node, children, ...props }) => (
				<ContentHeading
					as="h2"
					label={node ? textContent(node) : ''}
					{...props}
				>
					{children}
				</ContentHeading>
			),
			h3: ({ node, children, ...props }) => (
				<ContentHeading
					as="h3"
					label={node ? textContent(node) : ''}
					{...props}
				>
					{children}
				</ContentHeading>
			),
			h4: ({ node, children, ...props }) => (
				<ContentHeading
					as="h4"
					label={node ? textContent(node) : ''}
					{...props}
				>
					{children}
				</ContentHeading>
			),
			h5: ({ node, children, ...props }) => (
				<ContentHeading
					as="h5"
					label={node ? textContent(node) : ''}
					{...props}
				>
					{children}
				</ContentHeading>
			),
			h6: ({ node, children, ...props }) => (
				<ContentHeading
					as="h6"
					label={node ? textContent(node) : ''}
					{...props}
				>
					{children}
				</ContentHeading>
			),
			a: ({ node, ...props }) => (
				<ContentLink {...props} node={node} slug={slug} assets={assets} />
			),
			pre: ({ node, children }) => {
				const code = node?.children.find(
					(child) => child.type === 'element' && child.tagName === 'code'
				)
				if (code?.type !== 'element') return <pre>{children}</pre>
				const offset = node?.position?.start.offset
				const block =
					offset === undefined ? undefined : prepared.codeBlocks[offset]
				const classNames = code.properties.className
				const language = Array.isArray(classNames)
					? classNames
							.find(
								(name) =>
									typeof name === 'string' && name.startsWith('language-')
							)
							?.toString()
							.slice(9)
					: undefined
				// remark-rehype appends one display newline; it is not source code.
				const plainCode = textContent(code).replace(/\n$/, '')
				const plainLanguage = language?.toLowerCase() ?? 'text'
				return (
					<MarkdownCodeBlock
						key={`${offset}:${plainCode}`}
						block={
							block?.code === plainCode && block.language === plainLanguage
								? block
								: { code: plainCode, language: plainLanguage }
						}
					/>
				)
			},
			blockquote: ContentBlockquote,
			...markdownTableComponents,
		}),
		[slug, assets, prepared]
	)
	return (
		<section
			aria-label="Article content"
			className="prose max-w-none min-w-0 wrap-anywhere prose-neutral dark:prose-invert prose-a:decoration-transparent prose-a:transition-[text-decoration-color] prose-a:duration-300 prose-a:ease-in-out prose-a:hover:decoration-current prose-a:motion-reduce:transition-none [&_[id]]:scroll-mt-24"
		>
			<Markdown
				remarkPlugins={[remarkGfm, remarkArticleHeadings, remarkCallouts]}
				rehypePlugins={[rehypeImageContext]}
				skipHtml
				components={components}
			>
				{content}
			</Markdown>
		</section>
	)
}
