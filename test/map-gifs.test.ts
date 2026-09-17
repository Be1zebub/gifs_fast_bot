import { describe, expect, test } from "vitest"
import { parseKlipyGifs, toInlineResults } from "../src/lib/klipy"

const mp4 = (url: string, width = 480, height = 270) => ({ url, width, height })

describe("parseKlipyGifs", () => {
	test("reads data.data and skips junk entries", () => {
		const gifs = parseKlipyGifs({
			data: {
				data: [
					{
						id: 1,
						title: "Cake",
						file: { hd: { mp4: mp4("https://cdn.example/hd.mp4") } },
					},
					{ not: "a gif" },
					null,
				],
			},
		})

		expect(gifs).toEqual([
			{
				id: "1",
				title: "Cake",
				file: { hd: { mp4: mp4("https://cdn.example/hd.mp4") } },
			},
		])
	})

	test("drops non-finite media dimensions", () => {
		expect(
			parseKlipyGifs({
				data: {
					data: [
						{
							id: 4,
							file: {
								hd: {
									mp4: {
										url: "https://cdn.example/hd.mp4",
										width: Number.NaN,
										height: -1,
									},
								},
							},
						},
					],
				},
			}),
		).toEqual([
			{
				id: "4",
				file: { hd: { mp4: { url: "https://cdn.example/hd.mp4" } } },
			},
		])
	})

	test("returns an empty list for a malformed payload", () => {
		expect(parseKlipyGifs(null)).toEqual([])
		expect(parseKlipyGifs({ data: { data: "nope" } })).toEqual([])
	})
})

describe("toInlineResults", () => {
	test("prefers hd mp4 and an animated thumbnail", () => {
		expect(
			toInlineResults(
				[
					{
						id: "1",
						title: "Cake",
						file: {
							hd: {
								mp4: mp4("https://cdn.example/hd.mp4"),
								gif: mp4("https://cdn.example/hd.gif"),
							},
							md: { mp4: mp4("https://cdn.example/md.mp4") },
							sm: { mp4: mp4("https://cdn.example/sm.mp4", 220, 124) },
							xs: { jpg: { url: "https://cdn.example/xs.jpg" } },
						},
					},
				],
				"Trending",
			),
		).toEqual([
			{
				type: "mpeg4_gif",
				id: "1",
				mpeg4_url: "https://cdn.example/hd.mp4",
				mpeg4_width: 480,
				mpeg4_height: 270,
				thumbnail_url: "https://cdn.example/sm.mp4",
				thumbnail_mime_type: "video/mp4",
				title: "Cake",
			},
		])
	})

	test("falls back to md mp4, then hd gif, then a static thumbnail", () => {
		expect(
			toInlineResults(
				[
					{
						id: "2",
						file: {
							md: { mp4: mp4("https://cdn.example/md.mp4", 320, 180) },
							xs: { jpg: { url: "https://cdn.example/xs.jpg" } },
						},
					},
					{
						id: "3",
						file: {
							hd: { gif: mp4("https://cdn.example/hd.gif", 400, 400) },
							xs: { jpg: { url: "https://cdn.example/xs.jpg" } },
						},
					},
				],
				"cats",
			),
		).toEqual([
			{
				type: "mpeg4_gif",
				id: "2",
				mpeg4_url: "https://cdn.example/md.mp4",
				mpeg4_width: 320,
				mpeg4_height: 180,
				thumbnail_url: "https://cdn.example/xs.jpg",
				thumbnail_mime_type: "image/jpeg",
				title: "cats",
			},
			{
				type: "gif",
				id: "3",
				gif_url: "https://cdn.example/hd.gif",
				gif_width: 400,
				gif_height: 400,
				thumbnail_url: "https://cdn.example/xs.jpg",
				thumbnail_mime_type: "image/jpeg",
				title: "cats",
			},
		])
	})

	test("drops entries that lack playable media or a thumbnail", () => {
		expect(
			toInlineResults(
				[
					{
						id: "no-media",
						file: { sm: { mp4: mp4("https://cdn.example/sm.mp4") } },
					},
					{
						id: "no-thumb",
						file: { hd: { mp4: mp4("https://cdn.example/hd.mp4") } },
					},
				],
				"Trending",
			),
		).toEqual([])
	})
})
