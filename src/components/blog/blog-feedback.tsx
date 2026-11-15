import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'

import { ORPCError } from '@orpc/client'

export function BlogPending() {
	return (
		<main id="main-content" className="mx-auto max-w-3xl px-4 pt-20 pb-12">
			<output>Memuat tulisan…</output>
		</main>
	)
}

export function BlogNotFound() {
	return (
		<main
			id="main-content"
			className="mx-auto max-w-3xl space-y-4 px-4 pt-20 pb-12"
		>
			<h1>Tulisan tidak ditemukan</h1>
			<Link to="/blog" className="underline">
				Kembali ke daftar tulisan
			</Link>
		</main>
	)
}

export function BlogError({ error }: { error: unknown }) {
	const router = useRouter()
	const { reset } = useQueryErrorResetBoundary()
	const rateLimited =
		error instanceof ORPCError && error.code === 'TOO_MANY_REQUESTS'

	return (
		<main
			id="main-content"
			className="mx-auto max-w-3xl space-y-4 px-4 pt-20 pb-12"
		>
			<h1>Tulisan belum bisa dimuat</h1>
			<p role="alert">
				{rateLimited
					? 'Batas permintaan sumber tercapai. Coba lagi nanti.'
					: 'Terjadi kesalahan saat mengambil tulisan. Silakan coba lagi.'}
			</p>
			<button
				type="button"
				className="cursor-pointer underline focus-visible:outline-2 focus-visible:outline-offset-2"
				onClick={() => {
					reset()
					void router.invalidate()
				}}
			>
				Coba lagi
			</button>
		</main>
	)
}
