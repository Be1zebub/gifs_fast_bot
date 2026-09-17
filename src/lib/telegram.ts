import { fetchJson, isRecord, type FetchJsonResult } from "./http"

const TELEGRAM_API_ROOT = "https://api.telegram.org"

export interface TelegramUser {
	readonly language_code?: string
}

export interface TelegramChat {
	readonly id: number
}

export interface TelegramMessage {
	readonly chat: TelegramChat
	readonly text?: string
}

export interface TelegramInlineQuery {
	readonly id: string
	readonly query: string
	readonly from: TelegramUser
}

export interface TelegramUpdate {
	readonly inline_query?: TelegramInlineQuery
	readonly message?: TelegramMessage
}

interface InlineResultBase {
	readonly id: string
	readonly thumbnail_url: string
	readonly thumbnail_mime_type?: "image/jpeg" | "video/mp4"
	readonly title?: string
}

export interface InlineQueryResultGif extends InlineResultBase {
	readonly type: "gif"
	readonly gif_url: string
	readonly gif_width?: number
	readonly gif_height?: number
}

export interface InlineQueryResultMpeg4Gif extends InlineResultBase {
	readonly type: "mpeg4_gif"
	readonly mpeg4_url: string
	readonly mpeg4_width?: number
	readonly mpeg4_height?: number
}

export type InlineQueryResult = InlineQueryResultGif | InlineQueryResultMpeg4Gif

export function parseUpdate(input: unknown): TelegramUpdate | null {
	if (!isRecord(input)) return null

	const inlineQuery = "inline_query" in input ? parseInlineQuery(input.inline_query) : undefined
	if ("inline_query" in input && !inlineQuery) return null

	const message = "message" in input ? parseMessage(input.message) : undefined
	if ("message" in input && !message) return null

	return {
		...(inlineQuery ? { inline_query: inlineQuery } : {}),
		...(message ? { message } : {}),
	}
}

export async function answerInlineQuery(
	token: string,
	payload: {
		inline_query_id: string
		results: readonly InlineQueryResult[]
		cache_time: number
		is_personal: true
	},
): Promise<FetchJsonResult> {
	return callTelegram(token, "answerInlineQuery", payload)
}

export async function sendMessage(
	token: string,
	payload: { chat_id: number; text: string },
): Promise<FetchJsonResult> {
	return callTelegram(token, "sendMessage", payload)
}

function parseInlineQuery(input: unknown): TelegramInlineQuery | null {
	if (!isRecord(input)) return null
	if (typeof input.id !== "string" || input.id.length === 0) return null
	if (typeof input.query !== "string") return null
	if (!isRecord(input.from)) return null

	return {
		id: input.id,
		query: input.query,
		from:
			typeof input.from.language_code === "string"
				? { language_code: input.from.language_code }
				: {},
	}
}

function parseMessage(input: unknown): TelegramMessage | null {
	if (!isRecord(input)) return null
	if (!isRecord(input.chat) || typeof input.chat.id !== "number") return null

	return {
		chat: { id: input.chat.id },
		...(typeof input.text === "string" ? { text: input.text } : {}),
	}
}

async function callTelegram(
	token: string,
	method: "answerInlineQuery" | "sendMessage",
	payload: unknown,
): Promise<FetchJsonResult> {
	const result = await fetchJson(`${TELEGRAM_API_ROOT}/bot${token}/${method}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!result.ok) return result
	if (isTelegramOk(result.data)) return result

	return {
		ok: false,
		status: result.status,
		error: telegramDescription(result.data),
		ms: result.ms,
	}
}

function isTelegramOk(data: unknown): boolean {
	return isRecord(data) && data.ok === true
}

function telegramDescription(data: unknown): string {
	return isRecord(data) && typeof data.description === "string"
		? data.description
		: "telegram ok=false"
}
