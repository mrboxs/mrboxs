import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'cn'

function DimensionLine({
	vertical = false,
	children,
	className,
}: {
	vertical?: boolean
	children?: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				'flex items-center',
				vertical ? 'flex-col py-px' : 'px-px',
				className
			)}
		>
			<DimensionArrow vertical={vertical} />
			<span className={cn('flex-1 bg-current', vertical ? 'w-px' : 'h-px')} />
			{children != null && (
				<span
					className={cn(
						'font-mono text-xs/none tabular-nums',
						vertical ? 'py-1' : 'px-1'
					)}
				>
					{children}
				</span>
			)}
			<span className={cn('flex-1 bg-current', vertical ? 'w-px' : 'h-px')} />
			<DimensionArrow
				vertical={vertical}
				className={vertical ? '-scale-y-100' : '-scale-x-100'}
			/>
		</div>
	)
}

function DimensionArrow({
	vertical,
	className,
}: {
	vertical: boolean
	className?: string
}) {
	return (
		<svg
			className={cn('shrink-0', className)}
			width={vertical ? 7 : 9}
			height={vertical ? 9 : 7}
			viewBox={vertical ? '0 0 7 9' : '0 0 9 7'}
			fill="none"
			stroke="currentColor"
			strokeLinejoin="round"
		>
			<path d={vertical ? 'M3.5.5 6.5 8.5h-6Z' : 'M.5 3.5 8.5.5v6Z'} />
		</svg>
	)
}

export function FrameWidthDimension() {
	return (
		<div
			className="pointer-events-none relative hidden h-8 border-x border-line text-dimension select-none min-[49rem]:block"
			aria-hidden="true"
		>
			<span className="absolute inset-y-1 -left-px w-px bg-current" />
			<span className="absolute inset-y-1 -right-px w-px bg-current" />
			<DimensionLine className="absolute inset-x-[-1px] top-1/2 -translate-y-1/2">
				768
			</DimensionLine>
		</div>
	)
}

export function AvatarDiameterDimension() {
	return (
		<div
			className="pointer-events-none absolute inset-0 -z-1 hidden text-dimension select-none lg:block"
			aria-hidden="true"
		>
			<span className="absolute top-0 right-1/2 -left-8 h-px bg-current" />
			<span className="absolute right-1/2 bottom-0 -left-8 h-px bg-current" />
			<DimensionLine
				vertical
				className="absolute inset-y-0 -left-6 -translate-x-1/2"
			>
				Ø160
			</DimensionLine>
		</div>
	)
}

export function SectionSeparator({ children }: { children?: ReactNode }) {
	return (
		<div
			className="stripe-divider relative h-8 border-x border-line"
			aria-hidden="true"
		>
			{children}
		</div>
	)
}

export function ProfileSeparator() {
	return (
		<SectionSeparator>
			<div className="pointer-events-none absolute inset-0 hidden text-dimension select-none lg:block">
				<span className="absolute top-0 -right-8 left-full h-px bg-current" />
				<span className="absolute top-full -right-8 left-full h-px bg-current" />
				<DimensionLine
					vertical
					className="absolute -inset-y-px -right-6 translate-x-1/2"
				/>
				<span className="absolute top-1/2 left-full ml-8 -translate-y-1/2 font-mono text-xs/none">
					32
				</span>
			</div>
		</SectionSeparator>
	)
}

export function HandwrittenNote({
	className,
	...props
}: ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'pointer-events-none absolute font-handwritten text-xl/none text-muted-foreground select-none',
				className
			)}
			aria-hidden="true"
			{...props}
		/>
	)
}

export function HandwrittenArrow({ className }: { className?: string }) {
	return (
		<svg
			className={cn('size-8 shrink-0', className)}
			viewBox="0 0 40 40"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M34 4c1 15-5 26-21 30" />
			<path d="m22 37-9-3 7.5-8" />
		</svg>
	)
}
