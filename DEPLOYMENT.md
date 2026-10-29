# Rosalind Zhang · Public archive and protected workspace

This update targets the existing branch `rosalindzhang070508-zero-patch-1`.

## Public content
- Live date and seconds clock, explicitly labelled UTC+8 (Asia/Singapore).
- General, technology and medical news, fetched by the Worker from three fixed HTTPS feeds and cached for 30 minutes. No arbitrary URL proxy, article HTML rendering, or third-party RSS relay.
- Portfolio using the three existing histology PDFs and the existing visual journal. No fabricated research results.
- Existing photography and visual identity preserved.

## Personal workspace
`/private/` contains a local-browser checklist, the four CET-6 exercise panels, local synthetic audio and saved translation/writing drafts. It is not an iCloud calendar integration and does not synchronise drafts across devices. No private iCloud links, passwords or API keys are included.

The original public “Private OS” modal was a demonstration, not authentication. It has been removed from the built public page. Access is now checked by the Worker using Cloudflare Access JWT signature, issuer, audience and expiry validation with `jose`. Missing configuration returns 503; missing/invalid tokens return 401. Private responses are never cached. Do not treat localStorage as encryption or an authenticated cross-device database.

## Cloudflare deployment — important
This is a **Cloudflare Worker with Static Assets**, not a static Pages deployment. Do not publish `public/` through static Pages or any static-only host: that would bypass the Worker authentication. Deploy via `wrangler deploy` using the included `wrangler.jsonc`, which sets `run_worker_first: true` for every request. workers.dev and preview URLs are disabled to reduce alternate-origin exposure.

1. Connect the specified GitHub branch to a Cloudflare Worker build. Build command: `npm ci && npm run build`. Deploy command: `npx wrangler deploy`.
2. In Zero Trust → Access → Applications, create a Self-hosted application protecting `rosalindzhang.com/private` and all its subpaths. Create an Allow policy for **only your own email identity**, use an MFA-capable identity provider, and choose a short session such as 1 hour. Do not use an Everyone or Bypass policy. Check `www` separately if used.
3. Copy the Access team hostname (for example `your-team.cloudflareaccess.com`) and the application AUD tag into Worker variables `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. These identifiers are not login secrets. Do not put IdP credentials or Access service tokens in the repository.
4. Attach `rosalindzhang.com` as the Worker's custom domain. Reconcile the existing 404 route in the dashboard; do not blindly delete unrelated DNS records. The repository does not change DNS or enable public exposure automatically.
5. Verify in a logged-out browser: `/` is public; `/private/` and `/private/index.html` prompt Access; direct asset paths under `/private/` also require Access. After logging in with your allowlisted identity, test checklist and drafts. Test another identity is denied, and logout prevents subsequent private navigation.
6. Review managed WAF rules, HTTPS redirection, TLS settings and `/api/news` rate limiting for your existing Cloudflare plan. These account-level settings are **not applied by this code**. The code adds CSP, nosniff, frame protection, referrer and permissions policies, HSTS without assuming all subdomains are HTTPS-ready, and no-store on private routes. No claim of absolute protection is made.

## Local review
`npm ci`, `npm run build`, `npm test`, `npm run dev`. The unconfigured private route deliberately returns 503 locally. A real Access login is validated only after the owner configures the Cloudflare application. Never add a local-only bypass to production.

## Sources
- Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Worker-first static asset routing: https://developers.cloudflare.com/workers/static-assets/binding/

The website was returning an empty HTTP 404 on 2026-10-29 before these changes. Source completion does not confirm production deployment or account-level security settings.
