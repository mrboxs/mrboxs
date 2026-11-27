import { Link, useRouter } from '@tanstack/react-router'

import type {
	ComponentPropsWithoutRef,
	ComponentPropsWithRef,
	ReactElement,
} from 'react'
import { useState } from 'react'

import { IconExternalLink } from '@tabler/icons-react'
import { cn } from 'cn'
import type { Element, ElementContent } from 'hast'

import favicon from '#/assets/mrboxs-symbol.svg?url'
import { markdownAssetUrl } from '#/components/markdown-renderer/asset'
import {
	canPreviewExternal,
	ExternalLinkPreview,
	InternalLinkPreview,
} from '#/components/markdown-renderer/link-preview'
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from '#/components/ui/hover-card'
import { contentLink } from '#/constants/model'
import type { BlogPost } from '#/lib/blog'

function containsImage(node: Element | ElementContent): boolean {
	return (
		node.type === 'element' &&
		(node.tagName === 'img' || node.children.some(containsImage))
	)
}

export function ContentLink({
	href: reference,
	children,
	node,
	slug,
	assets,
	...props
}: ComponentPropsWithoutRef<'a'> & {
	node?: Element
	slug: string
	assets: BlogPost['assets']
}) {
	const router = useRouter()
	const href = reference
		? (markdownAssetUrl(reference, assets) ?? reference)
		: reference
	const target = href && contentLink(href, slug, router.origin)
	if (!target) {
		return (
			<a {...props} href={href} rel="noopener noreferrer">
				{children}
			</a>
		)
	}
	const imageLink = node && containsImage(node)
	const faviconSrc = target.internal
		? favicon
		: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(target.url.hostname)}&sz=32`
	const linkContent = (
		<>
			{!imageLink && <LinkFavicon key={faviconSrc} src={faviconSrc} />}
			{children}
		</>
	)
	if (!target.internal) {
		const link = (
			<a
				{...props}
				href={target.url.href}
				target="_blank"
				rel="noopener noreferrer"
			>
				{linkContent}
				<IconExternalLink
					className="ml-0.5 inline size-3.5 align-baseline"
					aria-hidden="true"
				/>
				<span className="sr-only"> (opens in a new tab)</span>
			</a>
		)
		return <PreviewLink link={link} url={target.url} />
	}
	if (
		target.url.pathname.startsWith('/api/') ||
		target.url.pathname.endsWith('.md')
	) {
		return (
			<a
				{...props}
				href={`${target.url.pathname}${target.url.search}${target.url.hash}`}
			>
				{linkContent}
			</a>
		)
	}

	const link = (
		<InternalContentLink {...props} url={target.url}>
			{linkContent}
		</InternalContentLink>
	)
	return <PreviewLink link={link} url={target.url} internalSlug={slug} />
}

function PreviewLink({
	link,
	url,
	internalSlug,
}: {
	link: ReactElement
	url: URL
	internalSlug?: string
}) {
	const { pathname, hash } = url
	const internal = internalSlug !== undefined
	if (internal) {
		const sameArticle =
			pathname.replace(/\/$/, '') ===
			`/blog/${encodeURIComponent(internalSlug)}`
		if (sameArticle && hash) return link
		if (pathname !== '/' && !/^\/blog(?:\/[^/]+)?\/?$/.test(pathname)) {
			return link
		}
	} else if (!canPreviewExternal(url)) {
		return link
	}

	return (
		<HoverCard>
			<HoverCardTrigger render={link} delay={350} />
			<HoverCardContent
				align="start"
				alignOffset={0}
				sideOffset={8}
				className="not-typeset w-72 max-w-[calc(100vw-2rem)] p-0 motion-reduce:animate-none"
			>
				{internal ? (
					<InternalLinkPreview url={url} />
				) : (
					<ExternalLinkPreview url={url} />
				)}
			</HoverCardContent>
		</HoverCard>
	)
}

function LinkFavicon({ src }: { src: string }) {
	const [failed, setFailed] = useState(false)
	if (failed) return null
	return (
		<img
			src={src}
			alt=""
			aria-hidden="true"
			width={16}
			height={16}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			className={cn(
				'not-typeset me-1 inline-block size-4 object-contain align-[-0.125em]',
				src === favicon && 'dark:invert'
			)}
			ref={(element) => {
				if (element?.complete) {
					void element.decode().catch(() => setFailed(true))
				}
			}}
			onError={() => setFailed(true)}
		/>
	)
}

function InternalContentLink({
	url,
	children,
	...props
}: Omit<ComponentPropsWithRef<'a'>, 'href'> & {
	url: URL
}) {
	const router = useRouter()
	const search = router.options.parseSearch(url.search)
	const hash = url.hash.slice(1)

	return (
		<Link {...props} to={url.pathname} search={search} hash={hash}>
			{children}
		</Link>
	)
}
