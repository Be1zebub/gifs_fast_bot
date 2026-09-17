import { vi } from "vitest"
import { isRecord } from "../src/lib/http"

export const TEST_ENV = {
	BOT_TOKEN: "test-bot-token",
	WEBHOOK_SECRET: "test-webhook-secret",
	KLIPY_KEY: "test-klipy-key",
	BOT_USERNAME: "gifs_fast_bot",
} as const satisfies Env

export function createExecutionContext(): {
	ctx: { waitUntil(promise: Promise<unknown>): void }
	flush: () => Promise<unknown[]>
} {
	const pending: Promise<unknown>[] = []

	return {
		ctx: {
			waitUntil(promise: Promise<unknown>) {
				pending.push(promise)
			},
		},
		flush: () => Promise.all(pending),
	}
}

export function stubFetch(
	handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
): { url: string; init?: RequestInit }[] {
	const calls: { url: string; init?: RequestInit }[] = []

	vi.stubGlobal(
		"fetch",
		(input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			calls.push(init ? { url: requestUrl(input), init } : { url: requestUrl(input) })
			return Promise.resolve(handler(requestUrl(input), init))
		},
	)

	return calls
}

export function parseJsonBody(init: RequestInit | undefined): Record<string, unknown> {
	if (typeof init?.body !== "string") throw new Error("expected a string request body")
	const value = JSON.parse(init.body) as unknown
	if (!isRecord(value)) throw new Error("expected a JSON object body")
	return value
}

function requestUrl(input: string | URL | Request): string {
	if (typeof input === "string") return input
	if (input instanceof URL) return input.href
	return input.url
}
