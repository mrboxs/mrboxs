import { act } from 'react'

export async function actAndFlush(action: () => void) {
	await act(async () => {
		action()
		await Promise.resolve()
	})
}
