import { afterEach, describe, expect, test, vi } from "vitest"
import { fetchJson } from "../src/lib/http"
import { stubFetch } from "./helpers"

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe("fetchJson", () => {
	test("returns parsed JSON on HTTP success", async () => {
		stubFetch(() => Response.json({ ok: true }))

		const result = await fetchJson("https://example.test/ok")
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.status).toBe(200)
		expect(result.data).toEqual({ ok: true })
		expect(result.ms).toBeGreaterThanOrEqual(0)
	})

	test("does not throw on HTTP errors", async () => {
		stubFetch(() => new Response("nope", { status: 502 }))

		const result = await fetchJson("https://example.test/fail")
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.status).toBe(502)
		expect(result.error).toBe("http 502")
		expect(result.ms).toBeGreaterThanOrEqual(0)
	})

	test("does not throw when the request is aborted", async () => {
		stubFetch(
			(_url, init) =>
				new Promise((_, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new Error("aborted"))
					})
				}),
		)

		const result = await fetchJson("https://example.test/slow", undefined, 20)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.status).toBeUndefined()
		expect(result.error.length).toBeGreaterThan(0)
		expect(result.ms).toBeGreaterThanOrEqual(0)
	})
})
