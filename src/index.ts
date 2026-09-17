import { handleRequest } from "./bot/webhook"

export default {
	fetch: handleRequest,
} satisfies ExportedHandler<Env>
