import { fetchJson, isRecord } from "./http"
import { logError } from "./log"
import type { InlineQueryResult } from "./telegram"

const KLIPY_API_ROOT = "https://api.klipy.com/api/v1"
const RESULTS_PER_PAGE = "50"
const CONTENT_FILTER = "low"
// Page 1 is KLIPY's editorial top (holidays, news). Page 2 is everyday content.
// fetchTrending falls back to page 1 when page 2 is empty for a locale.
const PREFERRED_TRENDING_PAGE = "2"
const FALLBACK_TRENDING_PAGE = "1"

type KlipyEndpoint = "search" | "trending"

export interface KlipyMedia {
	readonly url: string
	readonly width?: number
	readonly height?: number
}

export interface KlipyGif {
	readonly id: string
	readonly title?: string
	readonly file: {
		readonly hd?: { readonly mp4?: KlipyMedia; readonly gif?: KlipyMedia }
		readonly md?: { readonly mp4?: KlipyMedia }
		readonly sm?: { readonly mp4?: KlipyMedia }
		readonly xs?: { readonly jpg?: KlipyMedia }
	}
}

export async function fetchSearch(
	apiKey: string,
	options: { query: string; locale?: string },
): Promise<{ gifs: readonly KlipyGif[]; ms: number }> {
	return fetchGifs(apiKey, "search", {
		query: options.query,
		...(options.locale ? { locale: options.locale } : {}),
	})
}

export async function fetchTrending(
	apiKey: string,
	options: { locale?: string } = {},
): Promise<{ gifs: readonly KlipyGif[]; ms: number }> {
	const locale = options.locale ? { locale: options.locale } : {}
	const preferred = await fetchGifs(apiKey, "trending", {
		...locale,
		page: PREFERRED_TRENDING_PAGE,
	})
	if (preferred.gifs.length > 0) return preferred

	const fallback = await fetchGifs(apiKey, "trending", {
		...locale,
		page: FALLBACK_TRENDING_PAGE,
	})
	return { gifs: fallback.gifs, ms: preferred.ms + fallback.ms }
}

async function fetchGifs(
	apiKey: string,
	endpoint: KlipyEndpoint,
	options: { query?: string; locale?: string; page?: string } = {},
): Promise<{ gifs: readonly KlipyGif[]; ms: number }> {
	const url = new URL(`${KLIPY_API_ROOT}/${apiKey}/gifs/${endpoint}`)
	url.searchParams.set("per_page", RESULTS_PER_PAGE)
	url.searchParams.set("content_filter", CONTENT_FILTER)
	if (options.page) url.searchParams.set("page", options.page)
	if (options.query) url.searchParams.set("q", options.query)
	if (options.locale) url.searchParams.set("locale", options.locale)

	const result = await fetchJson(url.toString())
	if (!result.ok) {
		logError({ kind: "klipy", ok: false, endpoint, status: result.status, error: result.error })
		return { gifs: [], ms: result.ms }
	}

	return { gifs: parseKlipyGifs(result.data), ms: result.ms }
}

export function parseKlipyGifs(input: unknown): KlipyGif[] {
	if (!isRecord(input) || !isRecord(input.data) || !Array.isArray(input.data.data)) return []

	const gifs: KlipyGif[] = []
	for (const item of input.data.data) {
		const gif = parseGif(item)
		if (gif) gifs.push(gif)
	}
	return gifs
}

export function toInlineResults(
	gifs: readonly KlipyGif[],
	fallbackTitle: string,
): InlineQueryResult[] {
	const results: InlineQueryResult[] = []

	for (const gif of gifs) {
		const mp4 = gif.file.hd?.mp4 ?? gif.file.md?.mp4
		const gifFile = gif.file.hd?.gif
		const media = mp4 ?? gifFile
		const videoThumb = gif.file.sm?.mp4
		const staticThumb = gif.file.xs?.jpg
		const thumb = videoThumb ?? staticThumb
		if (!media || !thumb) continue

		const title = gif.title || fallbackTitle
		const thumbnail = {
			thumbnail_url: thumb.url,
			thumbnail_mime_type: videoThumb ? ("video/mp4" as const) : ("image/jpeg" as const),
			title,
		}

		if (mp4) {
			results.push({
				type: "mpeg4_gif",
				id: gif.id,
				mpeg4_url: mp4.url,
				...(mp4.width !== undefined ? { mpeg4_width: mp4.width } : {}),
				...(mp4.height !== undefined ? { mpeg4_height: mp4.height } : {}),
				...thumbnail,
			})
			continue
		}

		results.push({
			type: "gif",
			id: gif.id,
			gif_url: media.url,
			...(media.width !== undefined ? { gif_width: media.width } : {}),
			...(media.height !== undefined ? { gif_height: media.height } : {}),
			...thumbnail,
		})
	}

	return results
}

function parseGif(input: unknown): KlipyGif | null {
	if (!isRecord(input)) return null
	if (typeof input.id !== "string" && typeof input.id !== "number") return null

	const file = parseFile(input.file)
	if (!file) return null

	return {
		id: String(input.id),
		...(typeof input.title === "string" ? { title: input.title } : {}),
		file,
	}
}

function parseFile(input: unknown): KlipyGif["file"] | null {
	if (input === undefined) return {}
	if (!isRecord(input)) return null

	const hd = parseHd(input.hd)
	const md = parseMp4(input.md)
	const sm = parseMp4(input.sm)
	const xs = parseJpg(input.xs)

	return {
		...(hd ? { hd } : {}),
		...(md ? { md } : {}),
		...(sm ? { sm } : {}),
		...(xs ? { xs } : {}),
	}
}

function parseHd(input: unknown): KlipyGif["file"]["hd"] {
	if (!isRecord(input)) return undefined
	const mp4 = parseMedia(input.mp4)
	const gif = parseMedia(input.gif)
	if (!mp4 && !gif) return undefined
	return { ...(mp4 ? { mp4 } : {}), ...(gif ? { gif } : {}) }
}

function parseMp4(input: unknown): { readonly mp4: KlipyMedia } | undefined {
	if (!isRecord(input)) return undefined
	const media = parseMedia(input.mp4)
	return media ? { mp4: media } : undefined
}

function parseJpg(input: unknown): { readonly jpg: KlipyMedia } | undefined {
	if (!isRecord(input)) return undefined
	const media = parseMedia(input.jpg)
	return media ? { jpg: media } : undefined
}

function parseMedia(input: unknown): KlipyMedia | undefined {
	if (!isRecord(input) || typeof input.url !== "string" || input.url.length === 0)
		return undefined
	const width = finiteDimension(input.width)
	const height = finiteDimension(input.height)
	return {
		url: input.url,
		...(width !== undefined ? { width } : {}),
		...(height !== undefined ? { height } : {}),
	}
}

function finiteDimension(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}
