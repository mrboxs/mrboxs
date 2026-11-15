import type { Components } from 'react-markdown'

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '#/components/ui/table'

export const markdownTableComponents: Pick<
	Components,
	'table' | 'thead' | 'tbody' | 'tr' | 'th' | 'td'
> = {
	table: ({ node: _node, ...props }) => (
		<Table
			{...props}
			className="wrap-normal"
			containerProps={{
				role: 'region',
				'aria-label': 'Table',
				tabIndex: 0,
				className:
					'not-prose my-6 rounded-lg border focus-visible:outline-2 focus-visible:outline-ring',
			}}
		/>
	),
	thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
	tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
	tr: ({ node: _node, ...props }) => <TableRow {...props} />,
	th: ({ node: _node, ...props }) => <TableHead {...props} scope="col" />,
	td: ({ node: _node, ...props }) => (
		<TableCell {...props} className="whitespace-normal" />
	),
}
