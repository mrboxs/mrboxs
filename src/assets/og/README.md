# Social preview assets

`symbol.svg` is the dark symbol from [mrboxs-brandkit](https://github.com/mrboxs/mrboxs-brandkit/blob/main/01-logos/dark/mrboxs-symbol.svg), retrieved from revision `fb83810ece286280087cbfc35758c8013fde3bf8`.

`geist-regular.bin` is the unmodified `Geist-Regular.ttf` distributed with `@vercel/og` 0.11.1. The `.bin` extension lets Cloudflare import it as an ArrayBuffer Data module. Its SIL Open Font License is included in `OFL.txt`. The renderer is pinned to 0.11.1, with compiled Yoga and resvg WASM imports for Cloudflare Workers. Verify the Worker adapter in `scripts/vercel-og.ts` when upgrading the renderer.

The isometric artwork comes from the existing `src/assets/mrboxs-isometric.ts`. Public favicon, Apple touch icon, and application icons are the supplied brandkit assets, using the small symbol for tab icons and the full symbol for larger icons.
