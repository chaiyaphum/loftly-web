# CLAUDE.md

This is **loftly-web** — the Next.js 15 (App Router) frontend for Loftly, the Thai AI-native credit-card rewards platform.

- **Page inventory, wireframes, components**: `../loftly/mvp/UI_WEB.md`
- **Voice and copy rules**: `../loftly/BRAND.md` §4 (no buzzwords; Thai preserved where natural; always show the math)
- **API contract**: `../loftly/mvp/API_CONTRACT.md` — base `https://api.loftly.co.th/v1`

**Package manager**: npm only. **Do not** use pnpm on this repo — the host runs npm 10 / Node 22.

All user-facing copy lives in `messages/th.json` + `messages/en.json`. Never hardcode strings in JSX. THB numbers use the `THB` prefix, not `฿`.
