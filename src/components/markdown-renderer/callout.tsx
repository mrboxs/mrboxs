import type { ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'

import {
	IconAlertOctagon,
	IconAlertTriangle,
	IconBulb,
	IconExclamationCircle,
	IconInfoCircle,
} from '@tabler/icons-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

const callouts = {
	note: { title: 'Note', icon: IconInfoCircle },
	tip: { title: 'Tip', icon: IconBulb },
	important: { title: 'Important', icon: IconExclamationCircle },
	warning: { title: 'Warning', icon: IconAlertTriangle },
	caution: { title: 'Caution', icon: IconAlertOctagon },
} as const

function isCalloutType(value: unknown): value is keyof typeof callouts {
	return typeof value === 'string' && Object.hasOwn(callouts, value)
}

export function ContentBlockquote({
	node,
	children,
	...props
}: ComponentPropsWithoutRef<'blockquote'> & ExtraProps) {
	const type = node?.properties['data-callout']
	if (!isCalloutType(type)) {
		return <blockquote {...props}>{children}</blockquote>
	}
	const { title, icon: Icon } = callouts[type]
	return (
		<Alert
			role="note"
			aria-label={title}
			data-callout={type}
			variant={type === 'caution' ? 'destructive' : 'default'}
			className="my-6 not-italic"
		>
			<Icon aria-hidden="true" />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
				{children}
			</AlertDescription>
		</Alert>
	)
}
