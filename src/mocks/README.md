# mocks/

A small fake REST backend built with MSW (Mock Service Worker). The same handlers serve:

- the app in development when `API_MOCKS=true` (`.env.dev`), through `mocks/native.ts`
- Jest tests, through `mocks/node.ts`

It is a stand-in for a real API, so it deliberately imports nothing from the app: it speaks JSON
(snake_case, like many real backends) and the app's feature `api/` modules map it to models.

`handlers.ts` holds auth, `/me` and posts; each generated feature adds `src/mocks/<feature>.ts`, whose table
reseeds with the mock db. Shared helpers (`wait`, `authenticate`, `error`) are in `helpers.ts`.

Endpoints: `POST /auth/login|register|refresh|forgot-password|logout`, `GET|DELETE /me`,
`GET /posts?cursor&limit`, `GET /posts/:id`, `POST|DELETE /posts/:id/like`.
Demo account: `demo@example.com` / `password123`. A new post containing `#fail` is refused (422), to show
the failed upload state. Access tokens expire after 2 minutes to exercise refresh.
