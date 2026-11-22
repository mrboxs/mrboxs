import { describe, expect, it, vi } from 'vite-plus/test'

import { ImageResponse } from '@vercel/og'
import sharp from 'sharp'

import { OgCard, ogSize } from '#/lib/og/card'

import { blogMetadata } from '../helpers/blog'

vi.mock('void/env', () => ({
	env: {
		APP_URL: 'https://portfolio.example.test',
		VITE_APP_URL: 'https://portfolio.example.test',
	},
}))

describe('OG raster output', () => {
	it.each([
		undefined,
		{
			...blogMetadata,
			title:
				'Catatan kecil di sela kode: TypeScript, JavaScript, café, and a very long title '.repeat(
					4
				),
			description: 'Text '.repeat(120),
		},
	])(
		'renders a real 1200×630 dark PNG for home and long article titles',
		async (post) => {
			const response = new ImageResponse(<OgCard post={post} />, ogSize)
			const buffer = new Uint8Array(await response.arrayBuffer())
			const image = sharp(buffer)
			expect(await image.metadata()).toMatchObject({
				format: 'png',
				width: 1200,
				height: 630,
			})
			const pixel = await image
				.extract({ left: 1, top: 1, width: 1, height: 1 })
				.removeAlpha()
				.raw()
				.toBuffer()
			expect([...pixel]).toEqual([8, 8, 8])
			const mark = await sharp(buffer)
				.extract({ left: 80, top: 44, width: 45, height: 54 })
				.removeAlpha()
				.raw()
				.toBuffer()
			expect(mark.some((value) => value > 200)).toBe(true)
		},
		20_000
	)
})
