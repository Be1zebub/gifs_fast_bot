import { describe, expect, test } from "vitest"
import { parseUpdate } from "../src/lib/telegram"

describe("parseUpdate", () => {
	test("rejects non-objects", () => {
		expect(parseUpdate(null)).toBeNull()
		expect(parseUpdate("update")).toBeNull()
		expect(parseUpdate(1)).toBeNull()
		expect(parseUpdate([1])).toBeNull()
	})

	test("accepts an empty object as an ignored update", () => {
		expect(parseUpdate({})).toEqual({})
	})

	test("parses an inline query and keeps extra fields out", () => {
		expect(
			parseUpdate({
				update_id: 99,
				inline_query: {
					id: "iq-1",
					query: "cake",
					from: { id: 1, is_bot: false, first_name: "Ada", language_code: "ru-RU" },
					offset: "",
				},
			}),
		).toEqual({
			inline_query: {
				id: "iq-1",
				query: "cake",
				from: { language_code: "ru-RU" },
			},
		})
	})

	test("allows a missing language_code", () => {
		expect(
			parseUpdate({
				inline_query: {
					id: "iq-2",
					query: "",
					from: { id: 1, is_bot: false, first_name: "Ada" },
				},
			}),
		).toEqual({
			inline_query: { id: "iq-2", query: "", from: {} },
		})
	})

	test("rejects a malformed inline_query even if a message is valid", () => {
		expect(
			parseUpdate({
				inline_query: { query: "cake", from: {} },
				message: { chat: { id: 1 }, text: "/start" },
			}),
		).toBeNull()
	})

	test("rejects inline_query when query is not a string", () => {
		expect(
			parseUpdate({
				inline_query: { id: "iq-3", query: 1, from: {} },
			}),
		).toBeNull()
	})

	test("parses a private-chat message", () => {
		expect(
			parseUpdate({
				message: {
					message_id: 8,
					chat: { id: 42, type: "private" },
					text: "/start",
					from: { id: 1, is_bot: false, first_name: "Ada" },
				},
			}),
		).toEqual({
			message: { chat: { id: 42 }, text: "/start" },
		})
	})

	test("parses a message without text", () => {
		expect(parseUpdate({ message: { chat: { id: 42 } } })).toEqual({
			message: { chat: { id: 42 } },
		})
	})

	test("rejects a message without a numeric chat id", () => {
		expect(parseUpdate({ message: { chat: { id: "42" }, text: "/start" } })).toBeNull()
		expect(parseUpdate({ message: { text: "/start" } })).toBeNull()
	})
})
