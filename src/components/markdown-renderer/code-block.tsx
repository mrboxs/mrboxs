import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { IconCheck, IconCopy, IconTextWrap, IconX } from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '#/components/ui/button'
import { Toggle } from '#/components/ui/toggle'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import type { CodeTokenStyle, PreparedCodeBlock } from '#/constants/model'

function themeStyles(light: CodeTokenStyle, dark: CodeTokenStyle) {
	const style: CSSProperties & Record<`--${string}`, string | undefined> = {}
	for (const [theme, value] of Object.entries({ light, dark })) {
		const fontStyle = value.fontStyle ?? 0
		style[`--code-${theme}-color`] = value.color
		style[`--code-${theme}-bg`] = value.bgColor
		style[`--code-${theme}-style`] = fontStyle & 1 ? 'italic' : 'normal'
		style[`--code-${theme}-weight`] = fontStyle & 2 ? '700' : '400'
		style[`--code-${theme}-decoration`] =
			[fontStyle & 4 ? 'underline' : '', fontStyle & 8 ? 'line-through' : '']
				.filter(Boolean)
				.join(' ') || 'none'
	}
	return style
}

export function MarkdownCodeBlock({ block }: { block: PreparedCodeBlock }) {
	const [wordWrap, setWordWrap] = useState(false)
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
		'idle'
	)
	const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	)
	const copyAttempt = useRef(0)
	useEffect(
		() => () => {
			clearTimeout(resetTimer.current)
			copyAttempt.current++
		},
		[]
	)

	async function copyCode() {
		const attempt = ++copyAttempt.current
		clearTimeout(resetTimer.current)
		let state: 'copied' | 'failed'
		try {
			await navigator.clipboard.writeText(block.code)
			state = 'copied'
		} catch {
			state = 'failed'
		}
		if (copyAttempt.current !== attempt) return
		setCopyState(state)
		resetTimer.current = setTimeout(() => setCopyState('idle'), 2500)
	}

	return (
		<div
			className="not-typeset my-6 overflow-hidden rounded-lg border border-border"
			data-code-block
		>
			<div className="flex items-center justify-between gap-3 border-b border-border bg-transparent px-3 py-2">
				<span className="truncate font-mono text-xs text-muted-foreground">
					{block.language}
				</span>
				<div className="flex shrink-0 items-center gap-1">
					<Tooltip>
						<TooltipTrigger
							render={
								<Toggle
									size="sm"
									className="size-7 p-0"
									pressed={wordWrap}
									onPressedChange={setWordWrap}
									aria-label="Word wrap"
								/>
							}
						>
							<IconTextWrap aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>
							{wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="size-7 p-0"
									onClick={() => {
										void copyCode()
									}}
									aria-label="Copy code"
								/>
							}
						>
							{copyState === 'copied' ? (
								<IconCheck aria-hidden="true" />
							) : copyState === 'failed' ? (
								<IconX aria-hidden="true" />
							) : (
								<IconCopy aria-hidden="true" />
							)}
						</TooltipTrigger>
						<TooltipContent>
							{copyState === 'copied'
								? 'Copied'
								: copyState === 'failed'
									? 'Copy failed'
									: 'Copy code'}
						</TooltipContent>
					</Tooltip>
				</div>
				<output className="sr-only">
					{copyState === 'copied'
						? 'Code copied to clipboard.'
						: copyState === 'failed'
							? 'Unable to copy code. Select and copy it manually.'
							: ''}
				</output>
			</div>
			<pre
				className={cn(
					'public-code m-0 overflow-x-auto p-4 text-sm leading-6',
					wordWrap ? 'wrap-anywhere whitespace-pre-wrap' : 'whitespace-pre'
				)}
				style={
					block.colors
						? themeStyles(block.colors.light, block.colors.dark)
						: undefined
				}
				// Keyboard users need to scroll long lines without selecting text.
				// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
				tabIndex={0}
				aria-label={`${block.language} code`}
			>
				<code>
					{/* Positions are stable within a block keyed by its complete source. */}
					{/* oxlint-disable react/no-array-index-key */}
					{block.tokens
						? block.tokens.map((line, lineIndex) => (
								<Fragment key={lineIndex}>
									{lineIndex > 0 ? '\n' : null}
									{line.map((token, tokenIndex) => (
										<span
											key={tokenIndex}
											className="public-code-token"
											style={themeStyles(token.light, token.dark)}
										>
											{token.content}
										</span>
									))}
								</Fragment>
							))
						: block.code}
					{/* oxlint-enable react/no-array-index-key */}
				</code>
			</pre>
		</div>
	)
}
