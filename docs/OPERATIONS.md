# OPERATIONS runbook — loftly-web

Day-2 procedures for running `loftly-web` in soft launch and beyond.

---

## Soft-launch invite-code gate

Phase 1, W11 — capped at 100 users per `../loftly/mvp/OPEN_QUESTIONS.md` Q5.

### How the gate works

- `middleware.ts` runs on the Edge for every non-static, non-`/api/*` path.
- If `LOFTLY_INVITE_SECRET` and `LOFTLY_INVITE_CODES` are both set, the gate is
  **active**. Otherwise it's a pass-through (dev + preview builds keep working).
- Accepted entry paths:
  1. `?invite=<code>` on any URL — middleware validates, sets the
     `loftly_invite` cookie (HMAC-SHA256 over payload), strips the query, and
     redirects.
  2. The `/invite-required` form — POSTs to `/api/invite`, same outcome.
- Cookie is `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2_592_000` (30d).
- Missing or invalid cookies → 307 redirect to `/invite-required`.

Non-PII telemetry: middleware fires `invite_accepted` to the PostHog capture
endpoint with `distinct_id = invite:<sha256(code)[:8]>`. No user id, no email.

### Required env vars

| Var | Required | Shape | Notes |
| --- | -------- | ----- | ----- |
| `LOFTLY_INVITE_CODES` | yes | JSON array of strings, e.g. `["ABC12345","DEF67890"]`; CSV also accepted | Keep codes 8+ chars, URL-safe base62. Case-sensitive. |
| `LOFTLY_INVITE_SECRET` | yes | 32-byte hex string (64 chars) | Used as the HMAC key. `openssl rand -hex 32`. |
| `LOFTLY_INVITE_COOKIE_VERSION` | no (default `1`) | integer | Bump to force-invalidate every issued cookie. |

Set these in Cloudflare Pages → **Settings → Environment variables →
Production**. Save as "secret" where available.

### Generating codes (offline)

```sh
# Generate 100 URL-safe base62 codes, 8 chars each.
python3 -c "
import secrets, string
alphabet = string.ascii_letters + string.digits
print(','.join(''.join(secrets.choice(alphabet) for _ in range(8)) for _ in range(100)))
"
```

Store the list in a private 1Password vault (`Loftly / Soft-launch invites`)
with one column for each code's assigned invitee (email, name, date sent).
Never commit the list to git.

Paste as JSON into `LOFTLY_INVITE_CODES`:

```sh
node -e 'const csv = process.argv[1]; console.log(JSON.stringify(csv.split(",")));' "$CSV"
```

### Distributing codes

1. Load the codes into the 1Password vault with assignees.
2. For each invitee, send a personalised email (template lives in the marketing
   doc repo under `PARTNERSHIP_OUTREACH/soft-launch-invite.md`) containing:
   ```
   https://loftly.biggo-analytics.dev/?invite=<their-code>
   ```
3. Single-click onboarding — the query-string accept path sets the cookie and
   drops them on the landing page.
4. Fallback for copy-paste mishaps: the `/invite-required` form accepts the
   same code pasted manually.

### Revoking a code

1. Remove the code from the `LOFTLY_INVITE_CODES` env var in Cloudflare.
2. Save + trigger a redeploy of `loftly-web` so the new env is picked up.
3. If the person is already in (cookie issued), bump
   `LOFTLY_INVITE_COOKIE_VERSION` by 1. This invalidates **every** issued
   cookie, forcing everyone to paste their code again. Use sparingly — only
   when a code was actually shared publicly or compromised.
4. Mark the row in the 1Password vault with `REVOKED — <date> — <reason>`.

### Monitoring

- PostHog dashboard: filter events by `event = invite_accepted` to see unique
  hashed codes accepted per day. Cross-reference against the 1Password log.
- Cloudflare Workers/Pages logs: `loftly_invite` cookie failures show up as
  307s to `/invite-required`. Sustained 307 volume from a single IP = someone
  without a code poking around.
- Sentry: any thrown `LOFTLY_INVITE_SECRET not configured` from
  `signInvite()` is a misconfiguration alarm.

### Removing the gate

When the soft-launch cap opens (per DEV_PLAN milestone):

1. Set `LOFTLY_INVITE_CODES=[]` in Cloudflare → redeploy. Gate is now
   pass-through for everyone.
2. After 30 days (one cookie lifetime) without regressions, delete the three
   env vars and this runbook's gate section.
3. Optionally: delete `middleware.ts`'s invite branch + `src/lib/invite.ts` +
   `/invite-required` in a cleanup PR.

---

*Last updated: April 2026*
