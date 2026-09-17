import { copy } from "./copy"
import { fetchSearch, fetchTrending, toInlineResults } from "../lib/klipy"
import { log, logError } from "../lib/log"
import {
	answerInlineQuery,
	sendMessage,
	type TelegramInlineQuery,
	type TelegramMessage,
	type TelegramUpdate,
} from "../lib/telegram"

const SEARCH_CACHE_SECONDS = 300
const TRENDING_CACHE_SECONDS = 60
const LOCALE_LENGTH = 2
const START_COMMAND = /^\/start(?:@([A-Za-z0-9_]+))?(?:$|\s)/

export async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
	if (update.inline_query) {
		await handleInlineQuery(update.inline_query, env)
		return
	}
	if (update.message) {
		await handleMessage(update.message, env)
		return
	}
	log({ kind: "ignored", ok: true })
}

async function handleInlineQuery(query: TelegramInlineQuery, env: Env): Promise<void> {
	const searchTerm = query.query.trim()
	const locale = query.from.language_code?.slice(0, LOCALE_LENGTH)

	const klipy = searchTerm
		? await fetchSearch(env.KLIPY_KEY, {
				query: searchTerm,
				...(locale ? { locale } : {}),
			})
		: await fetchTrending(env.KLIPY_KEY, locale ? { locale } : {})
	const results = toInlineResults(klipy.gifs, searchTerm || copy.trendingFallback)

	const telegram = await answerInlineQuery(env.BOT_TOKEN, {
		inline_query_id: query.id,
		results,
		cache_time: searchTerm ? SEARCH_CACHE_SECONDS : TRENDING_CACHE_SECONDS,
		is_personal: true,
	})

	if (telegram.ok) {
		log({
			kind: "inline_query",
			ok: true,
			empty_query: !searchTerm,
			locale: locale ?? null,
			results: results.length,
			klipy_ms: klipy.ms,
			telegram_ms: telegram.ms,
		})
		return
	}

	logError({
		kind: "inline_query",
		ok: false,
		empty_query: !searchTerm,
		locale: locale ?? null,
		results: results.length,
		klipy_ms: klipy.ms,
		telegram_ms: telegram.ms,
		error: telegram.error,
	})
}

async function handleMessage(message: TelegramMessage, env: Env): Promise<void> {
	if (!isStartCommand(message.text, env.BOT_USERNAME)) {
		log({ kind: "ignored", ok: true })
		return
	}

	const telegram = await sendMessage(env.BOT_TOKEN, {
		chat_id: message.chat.id,
		text: copy.startHelp(env.BOT_USERNAME),
	})

	if (telegram.ok) {
		log({ kind: "message", ok: true, command: "start", telegram_ms: telegram.ms })
		return
	}

	logError({
		kind: "message",
		ok: false,
		command: "start",
		telegram_ms: telegram.ms,
		error: telegram.error,
	})
}

function isStartCommand(text: string | undefined, botUsername: string): boolean {
	if (!text) return false
	const match = START_COMMAND.exec(text)
	if (!match) return false
	const mention = match[1]
	if (mention === undefined) return true
	return mention.toLowerCase() === botUsername.toLowerCase()
}
