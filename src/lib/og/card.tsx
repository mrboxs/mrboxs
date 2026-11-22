import type { ReactElement } from 'react'

import { mrboxsIsometric } from '#/assets/mrboxs-isometric'
import symbol from '#/assets/og/symbol.svg?raw'
import type { PostMetadata } from '#/lib/blog'
import { site } from '#/lib/site'

export const ogSize = { width: 1200, height: 630 } as const

function svgImage(svg: string): string {
	const bytes = new TextEncoder().encode(svg)
	return `data:image/svg+xml;base64,${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`
}

const mark = svgImage(symbol)
const isometric = svgImage(
	`<svg xmlns="http://www.w3.org/2000/svg" width="556" height="354" viewBox="${mrboxsIsometric.viewBox}"><defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M-1 1l2-2M0 10l10-10M9 11l2-2" stroke="#414141" stroke-width=".7"/></pattern></defs><g fill="#101010" stroke="#686868" stroke-width="1">${mrboxsIsometric.sides.map((face) => `<path d="${face.normal}"/>`).join('')}<path d="${mrboxsIsometric.top.normal}" fill="url(#hatch)" fill-rule="evenodd"/></g></svg>`
)

const layouts = {
	home: {
		image: { width: 500, height: 318, top: 165, opacity: 1 },
		content: { top: 200, width: 650, gap: 24 },
		title: { letterSpacing: -5, lineClamp: 1 },
		description: { fontSize: 29, maxWidth: 570, maxHeight: 130, lineClamp: 3 },
	},
	article: {
		image: { width: 420, height: 267, top: 215, opacity: 0.35 },
		content: { top: 180, width: 850, gap: 26 },
		title: { letterSpacing: -2, lineClamp: 4 },
		description: { fontSize: 24, maxWidth: 800, maxHeight: 72, lineClamp: 2 },
	},
} as const

function previewText(value: string, limit: number): string {
	const text = value.replace(/\s+/g, ' ').trim()
	const characters = Array.from(text)
	return characters.length > limit
		? `${characters
				.slice(0, limit - 1)
				.join('')
				.trimEnd()}…`
		: text
}

export function OgCard({ post }: { post?: PostMetadata }): ReactElement {
	const layout = post ? layouts.article : layouts.home
	const title = post ? previewText(post.title, 180) : site.name
	const description = previewText(post?.description ?? site.description, 170)
	const titleSize = post ? (title.length > 95 ? 46 : 58) : 106
	return (
		<div
			style={{
				display: 'flex',
				width: '100%',
				height: '100%',
				position: 'relative',
				background: '#080808',
				color: '#ffffff',
				fontFamily: 'geist',
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					display: 'flex',
					position: 'absolute',
					left: 48,
					top: 0,
					bottom: 0,
					width: 1,
					background: '#242424',
				}}
			/>
			<div
				style={{
					display: 'flex',
					position: 'absolute',
					right: 48,
					top: 0,
					bottom: 0,
					width: 1,
					background: '#242424',
				}}
			/>
			<div
				style={{
					display: 'flex',
					position: 'absolute',
					top: 140,
					width: '100%',
					height: 1,
					background: '#242424',
				}}
			/>
			<img
				src={isometric}
				alt=""
				width={layout.image.width}
				height={layout.image.height}
				style={{
					position: 'absolute',
					right: 56,
					...layout.image,
				}}
			/>
			<div
				style={{
					display: 'flex',
					position: 'absolute',
					left: 72,
					right: 72,
					top: 44,
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
					<img src={mark} alt="" width={54} height={54} />
					<span style={{ fontSize: 25 }}>{site.name}</span>
				</div>
				<span style={{ color: '#b8b8b8', fontSize: 20 }}>
					{post ? `Blog / ${post.publishedAt}` : 'Portfolio & blog'}
				</span>
			</div>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					position: 'absolute',
					left: 80,
					...layout.content,
				}}
			>
				<div
					style={{
						display: 'flex',
						fontSize: titleSize,
						lineHeight: 1.12,
						maxHeight: 275,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						wordBreak: 'break-word',
						...layout.title,
					}}
				>
					{title}
				</div>
				<div
					style={{
						display: 'flex',
						color: '#b8b8b8',
						lineHeight: 1.45,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						...layout.description,
					}}
				>
					{description}
				</div>
			</div>
			<div
				style={{
					display: 'flex',
					position: 'absolute',
					left: 0,
					bottom: 72,
					width: '100%',
					height: 1,
					background: '#242424',
				}}
			/>
			<div
				style={{
					display: 'flex',
					position: 'absolute',
					left: 80,
					right: 80,
					bottom: 25,
					justifyContent: 'space-between',
					color: '#b8b8b8',
					fontSize: 19,
				}}
			>
				<span>{new URL(site.origin).host}</span>
				<span>
					{post
						? `Written by ${previewText(post.author.name, 60)}`
						: profileSignature}
				</span>
			</div>
		</div>
	)
}

const profileSignature = 'Still figuring things out.'
