---
name: add-endpoint
description: Adds an API endpoint to a feature of this template - Zod response schema, TanStack Query options or a mutation hook with the right offline pattern, a mock handler and a test. Use when asked to call a new API, add a request, fetch or save data, or wire a screen to the backend.
---

# Add an endpoint

## 1. Generate

```bash
pnpm gen endpoint <feature> <name> --path /orders/:id                          # GET → query options
pnpm gen endpoint <feature> <name> --method post --path /orders/:id/cancel     # write → mutation hook
```

`--method` is `get` (default), `post`, `put`, `patch` or `delete`; `--path` defaults to `/<feature>`, and
each `:param` becomes an argument. It appends to the feature's files and creates a test:

| Where | What |
| --- | --- |
| `schema.ts` | `<Name>DtoSchema`, the `<Name>` model and `<Name>Schema` (transform) |
| `api.ts` | GET: `<name>QueryOptions(params)`. Writes: `use<Name>()` with `useMutation`, invalidating the feature's queries |
| `index.ts` | Exports it, for `src/app` |
| `src/mocks/<feature>.ts` | An MSW handler for the path (authenticated) |
| `src/features/<feature>/<name>.test.ts(x)` | Calls it against the mock and checks the mapped result |

The name can't clash with a schema already in `schema.ts` (a GET `/orders/:id` in feature `orders` is
`order-detail`, since `Order` exists).

Uploading a photo or file? Use `pnpm gen upload` and the `add-upload` skill instead: it writes an upload
that works offline.

## 2. Make it real

1. **Response.** Add the real fields to the DTO (snake_case if the server uses it), the model and the
   transform. The rest of the app sees only the model. Responses that fail the schema throw an `ApiError`
   of kind `validation`: never loosen a schema to make it pass.
2. **Request body.** Replace `body?: Record<string, unknown>` with a typed shape; validate form input
   with Zod before it gets here.
3. **Offline pattern** (AGENTS.md › Offline). The generated hook is pattern C (fails fast offline). For
   likes, edits and other low-stakes writes use `defineQueuedMutation` (A, or B with
   `useWaitingWrites`), define it at module level, keep variables JSON-safe and import its module from
   `src/app/queued-writes.ts`. Use `<OnlineOnly>` (D) for destructive or payment flows. Follow the
   sample in `docs/architecture.md` › Writing data (`useToggleLike` in the demo's `features/feed/api.ts`).
4. **Cache.** Prefer updating the cache from the response (`setQueryData`) over invalidating when the
   server returns the updated record. Optimistic updates go in `onMutate` with a rollback in `onError`.
5. **Mock.** Make the handler behave like the server: read and write the feature's table in
   `src/mocks/<feature>.ts`, return the server's error shape via `error(status, code, message)` from
   `src/mocks/helpers.ts`, and honour `Idempotency-Key` for writes that may be retried.
6. **Pagination.** Cursor lists use `cursorPageSchema` and `nextCursor` from `@/shared/api/pagination`
   with `infiniteQueryOptions` (the demo's `feedQueryOptions` does this).

## 3. Check

```bash
pnpm check
```

Add test cases for the error paths (`server.use(http.post('*/path', () => HttpResponse.json({…},
{ status: 409 })))`) and, for queued writes, the offline case: `act(() => onlineManager.setOnline(false))`, write, check it
shows as waiting, then go back online and check it synced.
