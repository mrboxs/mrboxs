import { Link, useRouter } from '@tanstack/react-router'

import type { ComponentPropsWithoutRef } from 'react'
import { useState } from 'react'

import { IconExternalLink } from '@tabler/icons-react'
import { cn } from 'cn'
import type { Element, ElementContent } from 'hast'

import favicon from '#/assets/mrboxs-symbol.svg?url'
import { markdownAssetUrl } from '#/components/markdown-renderer/asset'
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
		return (
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
	}
	if (target.url.pathname.startsWith('/api/')) {
		return (
			<a
				{...props}
				href={`${target.url.pathname}${target.url.search}${target.url.hash}`}
			>
				{linkContent}
			</a>
		)
	}

	return (
		<InternalContentLink {...props} url={target.url}>
			{linkContent}
		</InternalContentLink>
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
				'not-prose me-1 inline-block size-4 object-contain align-[-0.125em]',
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
}: Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
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
