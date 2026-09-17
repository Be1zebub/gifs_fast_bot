import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { handleRequest } from "../src/bot/webhook"
import { createExecutionContext, parseJsonBody, stubFetch, TEST_ENV } from "./helpers"

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined)
	vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const WEBHOOK = "https://bot.test/webhook"
const SECRET = "X-Telegram-Bot-Api-Secret-Token"

const cakeGif = {
	id: 7,
	title: "Cake",
	file: {
		hd: { mp4: { url: "https://cdn.example/cake.mp4", width: 480, height: 270 } },
		sm: { mp4: { url: "https://cdn.example/cake-sm.mp4" } },
	},
}

function webhookRequest(body: unknown, secret: string = TEST_ENV.WEBHOOK_SECRET): Request {
	return new Request(WEBHOOK, {
		method: "POST",
		headers: { "content-type": "application/json", [SECRET]: secret },
		body: JSON.stringify(body),
	})
}

describe("webhook", () => {
	test("answers non-webhook traffic with a health string", async () => {
		const { ctx } = createExecutionContext()
		const response = await handleRequest(new Request("https://bot.test/"), TEST_ENV, ctx)
		expect(response.status).toBe(200)
		expect(await response.text()).toBe("gifs-fast-bot ok")
	})

	test("rejects a webhook without the shared secret", async () => {
		const { ctx } = createExecutionContext()
		const response = await handleRequest(
			webhookRequest({ update_id: 1 }, "nope"),
			TEST_ENV,
			ctx,
		)
		expect(response.status).toBe(403)
		expect(await response.text()).toBe("forbidden")
	})

	test("acknowledges invalid JSON without calling upstream", async () => {
		const calls = stubFetch(() => {
			throw new Error("fetch should not run")
		})
		const { ctx, flush } = createExecutionContext()

		const response = await handleRequest(
			new Request(WEBHOOK, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					[SECRET]: TEST_ENV.WEBHOOK_SECRET,
				},
				body: "{",
			}),
			TEST_ENV,
			ctx,
		)

		expect(response.status).toBe(200)
		await flush()
		expect(calls).toEqual([])
	})

	test("searches KLIPY and answers an inline query", async () => {
		const calls = stubFetch((url) => {
			if (url.startsWith("https://api.klipy.com/")) {
				return Response.json({ data: { data: [cakeGif] } })
			}
			if (url.startsWith("https://api.telegram.org/")) {
				return Response.json({ ok: true })
			}
			throw new Error(url)
		})
		const { ctx, flush } = createExecutionContext()

		const response = await handleRequest(
			webhookRequest({
				inline_query: {
					id: "iq-9",
					query: "cake",
					from: { id: 1, is_bot: false, first_name: "Ada", language_code: "ru" },
				},
			}),
			TEST_ENV,
			ctx,
		)

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("ok")
		await flush()

		const klipy = calls.find((call) => call.url.startsWith("https://api.klipy.com/"))
		expect(klipy?.url).toContain("/gifs/search")
		expect(klipy?.url).toContain("q=cake")
		expect(klipy?.url).toContain("locale=ru")
		expect(new URL(klipy?.url ?? "").searchParams.has("page")).toBe(false)

		const telegram = calls.find((call) => call.url.includes("answerInlineQuery"))
		expect(telegram).toBeDefined()
		const payload = parseJsonBody(telegram?.init)
		expect(payload.inline_query_id).toBe("iq-9")
		expect(payload.cache_time).toBe(300)
		expect(payload.is_personal).toBe(true)
		expect(Array.isArray(payload.results)).toBe(true)
		const first: unknown = Array.isArray(payload.results) ? payload.results[0] : undefined
		if (!first || typeof first !== "object" || !("mpeg4_url" in first) || !("type" in first)) {
			throw new Error("expected an mpeg4 GIF result")
		}
		expect(first.type).toBe("mpeg4_gif")
		expect(first.mpeg4_url).toBe("https://cdn.example/cake.mp4")
	})

	test("uses trending when the inline query is empty", async () => {
		const calls = stubFetch((url) => {
			if (url.startsWith("https://api.klipy.com/")) {
				return Response.json({ data: { data: [cakeGif] } })
			}
			return Response.json({ ok: true })
		})
		const { ctx, flush } = createExecutionContext()

		await handleRequest(
			webhookRequest({
				inline_query: {
					id: "iq-10",
					query: "  ",
					from: { id: 1, is_bot: false, first_name: "Ada" },
				},
			}),
			TEST_ENV,
			ctx,
		)
		await flush()

		expect(calls[0]?.url).toContain("/gifs/trending")
		expect(new URL(calls[0]?.url ?? "").searchParams.get("page")).toBe("2")
		expect(calls[0]?.url).not.toContain("q=")
		expect(parseJsonBody(calls[1]?.init).cache_time).toBe(60)
		expect(parseJsonBody(calls[1]?.init).is_personal).toBe(true)
	})

	test("replies to /start and ignores other messages", async () => {
		const calls = stubFetch(() => Response.json({ ok: true }))
		const { ctx, flush } = createExecutionContext()

		await handleRequest(
			webhookRequest({ message: { chat: { id: 42 }, text: "/start" } }),
			TEST_ENV,
			ctx,
		)
		await flush()

		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toContain("sendMessage")
		const payload = parseJsonBody(calls[0]?.init)
		expect(payload.chat_id).toBe(42)
		expect(payload.text).toBe(
			"@gif ищет мимо.\n\nНапиши @gifs_fast_bot котики в любом чате и выбирай гифку.",
		)

		calls.length = 0
		const second = createExecutionContext()
		await handleRequest(
			webhookRequest({ message: { chat: { id: 42 }, text: "hello" } }),
			TEST_ENV,
			second.ctx,
		)
		await second.flush()
		expect(calls).toEqual([])
	})

	test("treats /start as a command token, not a prefix", async () => {
		const calls = stubFetch(() => Response.json({ ok: true }))

		const startup = createExecutionContext()
		await handleRequest(
			webhookRequest({ message: { chat: { id: 42 }, text: "/startup" } }),
			TEST_ENV,
			startup.ctx,
		)
		await startup.flush()
		expect(calls).toEqual([])

		const otherBot = createExecutionContext()
		await handleRequest(
			webhookRequest({ message: { chat: { id: 42 }, text: "/start@other_bot" } }),
			TEST_ENV,
			otherBot.ctx,
		)
		await otherBot.flush()
		expect(calls).toEqual([])

		const self = createExecutionContext()
		await handleRequest(
			webhookRequest({ message: { chat: { id: 42 }, text: "/start@gifs_fast_bot payload" } }),
			TEST_ENV,
			self.ctx,
		)
		await self.flush()
		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toContain("sendMessage")
	})

	test("answers an empty inline list when KLIPY fails", async () => {
		const calls = stubFetch((url) => {
			if (url.startsWith("https://api.klipy.com/")) {
				return new Response("upstream exploded", { status: 502 })
			}
			return Response.json({ ok: true })
		})
		const { ctx, flush } = createExecutionContext()

		await handleRequest(
			webhookRequest({
				inline_query: {
					id: "iq-11",
					query: "cake",
					from: { id: 1, is_bot: false, first_name: "Ada" },
				},
			}),
			TEST_ENV,
			ctx,
		)
		await flush()

		const telegram = calls.find((call) => call.url.includes("answerInlineQuery"))
		expect(telegram).toBeDefined()
		expect(parseJsonBody(telegram?.init).results).toEqual([])
	})

	test("acknowledges a telegram ok=false without throwing", async () => {
		const errors: string[] = []
		vi.spyOn(console, "error").mockImplementation((message: unknown) => {
			errors.push(String(message))
		})
		stubFetch((url) => {
			if (url.startsWith("https://api.klipy.com/")) {
				return Response.json({ data: { data: [cakeGif] } })
			}
			return Response.json({ ok: false, description: "QUERY_ID_INVALID" })
		})
		const { ctx, flush } = createExecutionContext()

		const response = await handleRequest(
			webhookRequest({
				inline_query: {
					id: "iq-12",
					query: "cake",
					from: { id: 1, is_bot: false, first_name: "Ada" },
				},
			}),
			TEST_ENV,
			ctx,
		)
		await flush()

		expect(response.status).toBe(200)
		expect(errors).toHaveLength(1)
		expect(errors[0]).toContain("QUERY_ID_INVALID")
		expect(errors[0]).not.toContain("upstream exploded")
	})

	test("acknowledges an oversized webhook without calling upstream", async () => {
		const calls = stubFetch(() => {
			throw new Error("fetch should not run")
		})
		const { ctx, flush } = createExecutionContext()
		const body = `{"message":{"chat":{"id":1},"text":"/start ${"x".repeat(70_000)}"}}`

		const response = await handleRequest(
			new Request(WEBHOOK, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					[SECRET]: TEST_ENV.WEBHOOK_SECRET,
				},
				body,
			}),
			TEST_ENV,
			ctx,
		)

		expect(response.status).toBe(200)
		await flush()
		expect(calls).toEqual([])
	})

	test("rejects a webhook with no secret header", async () => {
		const { ctx } = createExecutionContext()
		const response = await handleRequest(
			new Request(WEBHOOK, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ update_id: 1 }),
			}),
			TEST_ENV,
			ctx,
		)
		expect(response.status).toBe(403)
	})
})
