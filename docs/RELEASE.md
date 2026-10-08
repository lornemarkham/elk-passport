# Releasing I Am October

Short on purpose. The point is that we actually do it.

```
change  →  automated tests  →  deploy  →  production smoke  →  observability check
```

## 1. Automated tests

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
npm run e2e
```

`npm run e2e` builds and starts the app on :3100 itself. It drives the real
October journeys in a browser — the three production faults found on
2026-10-07 (a nav that highlighted nothing on the mapped domain, an
`ATLAS_API_URL` with a stray `/api`, a recovery link to localhost) were all
invisible to unit tests.

## 2. Deploy

```bash
cd app && npx vercel deploy --prod
```

**Environment variables only take effect on the next build.** Changing one in
the Vercel dashboard changes nothing about what is running; redeploy.

## 3. Production smoke — six things, about two minutes

Against `https://www.iamoctober.com`, not localhost:

1. **Root** opens Discover, and `Discover` is highlighted in the nav.
2. **Atlas is connected** — results include things that are not films or
   things to make. Zero Atlas rows means Atlas is unreachable, however healthy
   the page looks.
3. **Search `pumpkin`** returns results from more than one source.
4. **Open a result**, then come back — the search survives.
5. **Sign in**, choose one thing, open Choices, confirm it is there, sign out.
   _This is the one step no test covers._
6. **Password reset** — request one, click the link in the email, confirm it
   lands on `www.iamoctober.com/auth/callback` and **never on localhost**, set
   a password, sign in.

Steps 5 and 6 need a real session and a real inbox. They are the two things
automation cannot honestly do for us, which is exactly why they are the two
written down.

## 4. Observability check

```bash
npx vercel logs <deployment-url> --json | grep october-error
```

Browser failures reach the same place via `/api/client-errors`. Nothing is
expected after a clean release; anything found is the release telling you
something a test did not.

To put these somewhere better than `vercel logs`, add a Sentry DSN and replace
`deliver()` in `src/lib/observability/report.ts`. Nothing that calls
`reportError` has to change.

## Where configuration lives

| Thing                    | Where                                                   | Gotcha                                                                                          |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Atlas URL + token        | Vercel env, `elk-passport`                              | No trailing slash, **no `/api`** — the base is `https://elk-atlas.vercel.app`                   |
| Supabase auth redirects  | Supabase dashboard → Authentication → URL Configuration | Not in this repo. A `redirectTo` that is not in the allow-list is silently replaced by Site URL |
| Domain → October mapping | `src/lib/domains/experience-domains.ts`                 | A rewrite, not a redirect; the URL stays `/`                                                    |
