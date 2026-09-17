# gifs-fast-bot

[![ci][badge-ci]][ci] [![license][badge-license]][license]
[![github stars][badge-stars]][repo]
[![deploy][badge-deploy]][deploy]
![Visitors](https://visitor-badge.laobi.icu/badge?page_id=Be1zebub/gifs_fast_bot)

> Telegram inline GIF search. One Worker, no database, no runtime deps, no file proxy.

Live bot: [**@gifs_fast_bot**](https://t.me/gifs_fast_bot)

Type `@gifs_fast_bot cake` in any chat — DM, group, comments.  
Pick a result, Telegram sends it. Empty query is trending.

Telegram talks to the Worker > Worker talks to KLIPY > Telegram then pulls the file straight from KLIPY's CDN.  
Nothing is stored. Nothing is rehosted.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)][deploy]

The button clones this repo into your GitHub, asks for `BOT_TOKEN`, `KLIPY_KEY`, `WEBHOOK_SECRET`, and deploys a Worker.  
After that you still have to point Telegram at `/webhook` (see [Deploy](#deploy)).

## Why

Telegram's built-in GIF picker used to be Tenor. Google [shut down the public Tenor API](https://www.theverge.com/tech/959658/google-tenor-api-shutdown-gif-picker) on 30 June 2026 — tenor.com and Gboard still work, third-party apps got a hard error. Discord, WhatsApp, X migrated to other catalogs.

Telegram migrated too, onto its own index and ranking. The native search is now that catalog: contest leftovers, saved-GIF recirc, a ranking that does not match what you typed. Trending is not trending. Previews die. `@gif cake` is a coin flip.

This bot is the inline replacement. Same `@name query` habit, a real GIF API (KLIPY) instead of a dead Tenor pipe or Telegram's in-house search.

## Deploy

1. [@BotFather](https://t.me/BotFather) → `/newbot`. Save the token.
2. `/setinline` → placeholder **`Search KLIPY`**. KLIPY requires that string; an inline bot has nowhere else to put it.
3. Free API key from the [KLIPY](https://klipy.com) partner panel. Only `gifs` endpoints are used.
4. Hit the button. Cloudflare will clone the repo and prompt for secrets:

    [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)][deploy]

5. Point Telegram at the new Worker. `WEBHOOK_SECRET` must equal `secret_token`:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://gifs-fast-bot.<subdomain>.workers.dev/webhook&secret_token=$WEBHOOK_SECRET&drop_pending_updates=true"
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

Mismatch → `403` on every update.

### CLI instead of the button

```bash
git clone https://github.com/Be1zebub/gifs_fast_bot
cd gifs_fast_bot
pnpm install
pnpm wrangler login
pnpm wrangler secret put BOT_TOKEN
pnpm wrangler secret put KLIPY_KEY
pnpm wrangler secret put WEBHOOK_SECRET   # openssl rand -hex 32
pnpm deploy
```

If this is **your** bot, change `BOT_USERNAME` in `wrangler.jsonc` before deploy. That var is only interpolated into the `/start` text.

## Local

```bash
cp .dev.vars.example .dev.vars   # fill in the three secrets
pnpm dev
```

## Config

| Binding          | Type   | Default         | Purpose                                   |
| ---------------- | ------ | --------------- | ----------------------------------------- |
| `BOT_TOKEN`      | secret | —               | BotFather token                           |
| `KLIPY_KEY`      | secret | —               | KLIPY API key                             |
| `WEBHOOK_SECRET` | secret | —               | Must match `secret_token` on `setWebhook` |
| `BOT_USERNAME`   | var    | `gifs_fast_bot` | `/start` reply only                       |

Knobs in `src/lib/klipy.ts`:

| Knob             | Default       | Notes                           |
| ---------------- | ------------- | ------------------------------- |
| `content_filter` | `low`         | G, PG, PG-13. Ratings below.    |
| `per_page`       | `50`          | Telegram's own inline cap is 50 |
| trending page    | `2`, then `1` | Page 1 = editorial top          |

| `content_filter` | Includes                    |
| ---------------- | --------------------------- |
| `high`           | G                           |
| `medium`         | G, PG                       |
| `low`            | G, PG, PG-13                |
| `off`            | G, PG, PG-13, R (no nudity) |

```
src/index.ts         Worker entry
src/bot/webhook.ts   method, secret, parse, waitUntil
src/bot/app.ts       search / trending / /start
src/bot/copy.ts      user-facing strings
src/lib/klipy.ts     KLIPY fetch + map
src/lib/telegram.ts  Bot API + fail-closed update parser
src/lib/http.ts      fetchJson + 5s timeout
src/lib/secret.ts    timing-safe compare
src/lib/log.ts       structured JSON logs
test/                Vitest
```

```bash
pnpm test         # Vitest
pnpm check        # types + tsc + eslint + prettier + tests
```

## KLIPY

Attribution: [docs](https://docs.klipy.com/attribution) want **"Search KLIPY"** as the search-field placeholder. `/setinline` is the only surface Telegram gives you. Do that.

A watermark on the GIF is not possible here — Telegram renders KLIPY's URL, unmodified.

KLIPY's [integration requirements](https://docs.klipy.com/integration-requirements) say requests must come from the end-user client, not a partner proxy, unless you have written approval. A Cloudflare Worker **is** that proxy. If you run this in public, mail `developers@klipy.com` first.

## License

MIT

[repo]: https://github.com/Be1zebub/gifs_fast_bot
[ci]: https://github.com/Be1zebub/gifs_fast_bot/actions/workflows/check.yml
[license]: ./LICENSE
[deploy]: https://deploy.workers.cloudflare.com/?url=https://github.com/Be1zebub/gifs_fast_bot
[badge-ci]: https://github.com/Be1zebub/gifs_fast_bot/actions/workflows/check.yml/badge.svg
[badge-license]: https://img.shields.io/github/license/Be1zebub/gifs_fast_bot.svg
[badge-stars]: https://img.shields.io/github/stars/Be1zebub/gifs_fast_bot.svg?style=flat&logo=github
[badge-deploy]: https://img.shields.io/badge/deploy-cloudflare-F38020?logo=cloudflare&logoColor=white
