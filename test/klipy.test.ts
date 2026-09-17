import { afterEach, describe, expect, test, vi } from "vitest"
import { fetchSearch, fetchTrending } from "../src/lib/klipy"
import { stubFetch } from "./helpers"

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const cakeGif = {
	id: 7,
	title: "Cake",
	file: {
		hd: { mp4: { url: "https://cdn.example/cake.mp4", width: 480, height: 270 } },
		sm: { mp4: { url: "https://cdn.example/cake-sm.mp4" } },
	},
}

describe("fetchSearch", () => {
	test("does not send a page param", async () => {
		const calls = stubFetch(() => Response.json({ data: { data: [cakeGif] } }))

		await fetchSearch("key", { query: "cake", locale: "ru" })

		expect(calls).toHaveLength(1)
		const url = new URL(calls[0]?.url ?? "")
		expect(url.pathname).toContain("/gifs/search")
		expect(url.searchParams.get("q")).toBe("cake")
		expect(url.searchParams.get("content_filter")).toBe("low")
		expect(url.searchParams.has("page")).toBe(false)
	})
})

describe("fetchTrending", () => {
	test("asks for page 2 first", async () => {
		const calls = stubFetch(() => Response.json({ data: { data: [cakeGif] } }))

		const result = await fetchTrending("key", { locale: "ru" })

		expect(calls).toHaveLength(1)
		expect(new URL(calls[0]?.url ?? "").pathname).toContain("/gifs/trending")
		expect(new URL(calls[0]?.url ?? "").searchParams.get("page")).toBe("2")
		expect(result.gifs).toHaveLength(1)
	})

	test("falls back to page 1 when page 2 is empty", async () => {
		const calls = stubFetch((url) => {
			const page = new URL(url).searchParams.get("page")
			if (page === "2") return Response.json({ data: { data: [] } })
			if (page === "1") return Response.json({ data: { data: [cakeGif] } })
			throw new Error(url)
		})

		const result = await fetchTrending("key", { locale: "ru" })

		expect(calls).toHaveLength(2)
		expect(new URL(calls[0]?.url ?? "").searchParams.get("page")).toBe("2")
		expect(new URL(calls[1]?.url ?? "").searchParams.get("page")).toBe("1")
		expect(result.gifs).toHaveLength(1)
		expect(result.gifs[0]?.id).toBe("7")
	})
})
