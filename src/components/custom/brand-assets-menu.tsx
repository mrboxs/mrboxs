import { useTiks } from '@rexa-developer/tiks/react'
import {
	IconDownload,
	IconSquareDashed,
	IconTypeface,
} from '@tabler/icons-react'

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { toast } from '@/components/ui/toast'

export type BrandAssetsMenuProps = {
	logomark: React.ReactElement
	logomarkSVG: string
	logotypeSVG: string
	brandGuidelinesURL: string
	brandAssetsURL: string
	children: React.ReactElement
}

export function BrandAssetsMenu({
	logomark,
	logomarkSVG,
	logotypeSVG,
	brandGuidelinesURL,
	brandAssetsURL,
	children,
}: BrandAssetsMenuProps) {
	const { success } = useTiks()

	const copySVG = async (svg: string, label: string) => {
		if (!(await copyText(svg))) {
			toast.add({
				type: 'error',
				title: 'Could not copy SVG',
				description: 'Allow clipboard access and try again.',
			})
			return
		}

		toast.add({ type: 'success', title: `${label} as SVG copied` })
		success()
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger render={children} />

			<ContextMenuContent
				className="w-fit motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none [&_[data-slot=context-menu-item]]:cursor-pointer"
				aria-label="Brand assets"
			>
				<ContextMenuGroup>
					<ContextMenuItem
						onClick={() => {
							void copySVG(logomarkSVG, 'Logomark')
						}}
					>
						{logomark}
						Copy Logomark as SVG
					</ContextMenuItem>

					<ContextMenuItem
						onClick={() => {
							void copySVG(logotypeSVG, 'Logotype')
						}}
					>
						<IconTypeface />
						Copy Logotype as SVG
					</ContextMenuItem>
				</ContextMenuGroup>

				<ContextMenuSeparator />

				<ContextMenuGroup>
					<ContextMenuItem
						nativeButton={false}
						render={
							<a
								href={brandGuidelinesURL}
								aria-label="Brand Guidelines"
								target="_blank"
								rel="noopener noreferrer"
							/>
						}
					>
						<IconSquareDashed />
						Brand Guidelines
					</ContextMenuItem>

					<ContextMenuItem
						nativeButton={false}
						render={
							<a
								href={brandAssetsURL}
								aria-label="Download Brand Assets"
								target="_blank"
								rel="noopener noreferrer"
								download
							/>
						}
					>
						<IconDownload />
						Download Brand Assets
					</ContextMenuItem>
				</ContextMenuGroup>
			</ContextMenuContent>
		</ContextMenu>
	)
}

const copyText = async (text: string) => {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		return false
	}
}
