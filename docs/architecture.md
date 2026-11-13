# Architecture

How the code is organised and how data moves. The reasons are in the ADRs (0005, 0006, 0008).

## Layers

```
src/
  app/        composition: providers, navigation tree, boot sequence
  features/   one folder per feature: screens, components, hooks, api/, schema.ts, index.ts
  entities/   models shared by two or more features (user, session, push, app-status)
  data/       query client + persisted cache + offline queue
  shared/     no business knowledge: ui, api, ports, adapters, services, i18n, config, lifecycle, lib
  mocks/      MSW fake backend (dev + tests only)
  test/       test setup and helpers
```

Imports go downward only: `app → features → entities → data → shared`. Features never import each other.
ESLint (`eslint-plugin-boundaries`) and dependency-cruiser enforce it.

## Reading data

```
FeedScreen ─ useInfiniteQuery(feedQueryOptions()) ─▶ http.get('/posts', FeedPageSchema)
     ▲                                                     │  axios + auth header + retry/backoff
     │                                                     │  + circuit breaker + Zod parse
     └── re-render ◀── query cache (persisted to MMKV) ◀───┘  DTO (snake_case) → Post model
```

- Screens never call `http`; each feature's `api.ts` owns query keys, query options and mutations.
- The persisted cache means a cold start shows the last data before the network answers.

## Writing data

Every write picks an offline pattern (AGENTS.md › Offline). The reference is a queued, optimistic write
(pattern B), as in the demo's like button (`useToggleLike` in `features/feed/api.ts`):

1. `onMutate`: cancel in-flight queries, patch every cached copy optimistically.
2. Request goes out with an `Idempotency-Key` (safe to retry), but only while the account that queued it
   is still signed in. Scope idempotency keys per user on the server, so a replayed key never matches
   another account's record.
3. `onError`: restore the previous copy and show a toast.
4. `onSuccess`: adopt the server's copy (write endpoints return the updated resource; no follow-up GET).

```ts
// features/tasks/api.ts — defined at module level, and imported from src/app/queued-writes.ts.
const doneKey = ['tasks', 'done'] as const;

export const useSetDone = defineQueuedMutation<Task, { taskId: string; done: boolean }>({
  mutationKey: doneKey,
  mutationFn: ({ taskId, done, idempotencyKey }) =>
    http.put(`/tasks/${encodeURIComponent(taskId)}/done`, TaskSchema, {
      body: { done },
      idempotencyKey,
    }),
  onMutate: async ({ taskId, done }) => {
    await queryClient.cancelQueries({ queryKey: taskKeys.all });
    updateTask(queryClient, taskId, task => ({ ...task, done }));
  },
  onError: (_error, { taskId, done }) => {
    updateTask(queryClient, taskId, task => ({ ...task, done: !done }));
    toast.error(i18n.t('tasks.saveFailed'));
  },
  onSuccess: (task, { taskId }) => {
    // Two writes queued offline for one task: keep the optimistic state until the last one lands.
    if (hasLaterWrite<{ taskId: string }>(doneKey, variables => variables.taskId === taskId)) return;
    updateTask(queryClient, task.id, () => task);
  },
});

/** Ids of tasks whose write is waiting for a connection, to show "Waiting to sync". */
export function useWaitingTasks(): ReadonlySet<string> {
  return new Set(useWaitingWrites<{ taskId: string }>(doneKey).map(variables => variables.taskId));
}
```

`updateTask` applies a change to every cached copy (list pages and detail), like `updatePost` in the demo.

## Session

`entities/session` holds a small state machine (`unknown → signedOut | signedIn`) in Zustand. Tokens live only
in the Keychain/Keystore via `sessionTokens()`. The HTTP client refreshes once on 401 for all concurrent
requests; if the refresh fails it calls `onSessionExpired`, which signs out and clears every cached query.

## Ports and adapters

`shared/ports` defines interfaces (KeyValueStore, SecureStore, Logger, CrashReporter, Analytics, FeatureFlags,
Updates). `shared/services/services.ts` picks one adapter per port. App code calls `services()`; tests call
`setServices()` with fakes. Phase 3 swaps in Firebase adapters; Track B (Expo) swaps in Expo adapters.

## Boot

`app/boot.ts` runs once before the first screen: init i18n, pick the mock adapter (dev with `API_MOCKS=true`
only), configure HTTP, wire app life cycle to TanStack Query, restore the session. The native splash stays up
until boot, the persisted cache and the session are all ready, so the first frame is real content. If boot
throws, the error is reported and the session falls back to signed out, so the splash never stays up forever.
`afterBoot()` then does non-blocking work such as refreshing feature flags.
