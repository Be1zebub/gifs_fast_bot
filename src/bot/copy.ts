export const copy = {
	trendingFallback: "Trending",
	startHelp(username: string): string {
		return (
			`Inline GIF search.\n\n` +
			`Type @${username} and a query in any chat - pick a GIF and it gets sent here. ` +
			`No query shows trending.`
		)
	},
} as const
