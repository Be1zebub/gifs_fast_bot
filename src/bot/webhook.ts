import { handleUpdate } from "./app"
import { errorMessage, logError } from "../lib/log"
import { secretsEqual } from "../lib/secret"
import { parseUpdate } from "../lib/telegram"

const WEBHOOK_PATH = "/webhook"
const TELEGRAM_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const MAX_WEBHOOK_BYTES = 64 * 1024

export interface WaitUntilContext {
	waitUntil(promise: Promise<unknown>): void
}

export async function handleRequest(
	request: Request,
	env: Env,
	ctx: WaitUntilContext,
): Promise<Response> {
	const { pathname } = new URL(request.url)

	if (request.method !== "POST" || pathname !== WEBHOOK_PATH) {
		return new Response("gifs-fast-bot ok")
	}

	if (
		!(await secretsEqual(request.headers.get(TELEGRAM_SECRET_HEADER) ?? "", env.WEBHOOK_SECRET))
	) {
		return new Response("forbidden", { status: 403 })
	}

	const declaredLength = Number(request.headers.get("content-length"))
	if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
		logError({ kind: "parse", ok: false, error: "payload too large" })
		return new Response("ok")
	}

	const bytes = await request.arrayBuffer()
	if (bytes.byteLength > MAX_WEBHOOK_BYTES) {
		logError({ kind: "parse", ok: false, error: "payload too large" })
		return new Response("ok")
	}

	let raw: unknown
	try {
		raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown
	} catch (error) {
		logError({ kind: "parse", ok: false, error: errorMessage(error) })
		return new Response("ok")
	}

	const update = parseUpdate(raw)
	if (!update) {
		logError({ kind: "parse", ok: false, error: "invalid update" })
		return new Response("ok")
	}

	ctx.waitUntil(
		handleUpdate(update, env).catch((error: unknown) => {
			logError({ kind: "unhandled", ok: false, error: errorMessage(error) })
		}),
	)

	return new Response("ok")
}
