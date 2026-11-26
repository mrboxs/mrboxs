import {
	PageError,
	PageNotFound,
	PagePending,
} from '#/components/route-feedback'

export function BlogPending() {
	return <PagePending layout="post" />
}

export function BlogListPending() {
	return <PagePending layout="posts" />
}

export function BlogNotFound() {
	return <PageNotFound scope="blog" />
}

export function BlogError({ error }: { error: unknown }) {
	return <PageError error={error} scope="blog" />
}
