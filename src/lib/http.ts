import { errorMessage } from "./log"

const DEFAULT_TIMEOUT_MS = 5000

export type FetchJsonResult =
	| { ok: true; status: number; data: unknown; ms: number }
	| { ok: false; status: number | undefined; error: string; ms: number }

export async function fetchJson(
	url: string,
	init?: RequestInit,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FetchJsonResult> {
	const started = Date.now()

	try {
		const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
		const ms = Date.now() - started

		if (!response.ok) {
			return { ok: false, status: response.status, error: `http ${response.status}`, ms }
		}

		return { ok: true, status: response.status, data: await response.json(), ms }
	} catch (error) {
		return {
			ok: false,
			status: undefined,
			error: errorMessage(error),
			ms: Date.now() - started,
		}
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}
