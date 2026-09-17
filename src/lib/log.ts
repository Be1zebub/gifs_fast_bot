export type LogEvent =
	| {
			kind: "inline_query"
			ok: true
			empty_query: boolean
			locale: string | null
			results: number
			klipy_ms: number
			telegram_ms: number
	  }
	| {
			kind: "inline_query"
			ok: false
			empty_query: boolean
			locale: string | null
			results: number
			klipy_ms: number
			telegram_ms: number
			error: string
	  }
	| { kind: "message"; ok: true; command: "start"; telegram_ms: number }
	| { kind: "message"; ok: false; command: "start"; telegram_ms: number; error: string }
	| { kind: "ignored"; ok: true }
	| { kind: "parse"; ok: false; error: string }
	| {
			kind: "klipy"
			ok: false
			endpoint: "search" | "trending"
			status: number | undefined
			error: string
	  }
	| { kind: "unhandled"; ok: false; error: string }

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function log(event: Extract<LogEvent, { ok: true }>): void {
	console.log(JSON.stringify(event))
}

export function logError(event: Extract<LogEvent, { ok: false }>): void {
	console.error(JSON.stringify(event))
}
