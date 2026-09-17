export const copy = {
	trendingFallback: "Тренды",
	startHelp(username: string): string {
		return `@gif ищет мимо.\n\nНапиши @${username} котики в любом чате и выбирай гифку.`
	},
} as const
