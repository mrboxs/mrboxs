export type CodeTokenStyle = {
	color?: string
	bgColor?: string
	fontStyle?: number
}

export type CodeToken = {
	content: string
	light: CodeTokenStyle
	dark: CodeTokenStyle
}

export type PreparedCodeBlock = {
	code: string
	language: string
	tokens?: Array<Array<CodeToken>>
	colors?: { light: CodeTokenStyle; dark: CodeTokenStyle }
}

export type PreparedPublicContent = {
	codeBlocks: Record<string, PreparedCodeBlock>
}

export function emptyPublicContent(): PreparedPublicContent {
	return { codeBlocks: {} }
}

export function contentLink(href: string, slug: string, appUrl: string) {
	if (!href || href.startsWith('#')) return null
	try {
		const origin = new URL(appUrl).origin
		const url = new URL(href, `${origin}/blog/${encodeURIComponent(slug)}`)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
		const internal = url.origin === origin && !url.username && !url.password
		return { url, internal }
	} catch {
		return null
	}
}
