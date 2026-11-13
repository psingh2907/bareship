import { dehydrate, hydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http as mock, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { server } from '@/mocks/node';
import { http } from '@/shared/api/http';
import { services } from '@/shared/services/services';

import {
  defineQueuedMutation,
  resumeQueuedWrites,
  setQueueAccount,
  useWaitingWriteCount,
} from './offline';
import { createPersistOptions } from './persister';
import { queryClient } from './query-client';

type Sent = { n: number; key: string | null };

// Defined at module level, like a feature's api.ts, so a restored write finds its function.
const useTestWrite = defineQueuedMutation<{ ok: boolean }, { n: number }>({
  mutationKey: ['test', 'write'],
  mutationFn: ({ n, idempotencyKey }) =>
    http.post('/test-writes', z.object({ ok: z.boolean() }), { body: { n }, idempotencyKey }),
});

function captureWrites(): Sent[] {
  const sent: Sent[] = [];
  server.use(
    mock.post('*/test-writes', async ({ request }) => {
      const { n } = (await request.json()) as { n: number };
      sent.push({ n, key: request.headers.get('Idempotency-Key') });
      return HttpResponse.json({ ok: true });
    }),
  );
  return sent;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

async function renderWrite() {
  return renderHook(() => ({ write: useTestWrite(), waiting: useWaitingWriteCount() }), {
    wrapper,
  });
}

const goOffline = () =>
  act(async () => {
    onlineManager.setOnline(false);
  });
const goOnline = () =>
  act(async () => {
    onlineManager.setOnline(true);
  });

describe('queued writes', () => {
  it('wait while offline, then send once on reconnect with an idempotency key', async () => {
    const sent = captureWrites();
    const { result } = await renderWrite();
    await goOffline();

    await act(async () => result.current.write.mutate({ n: 1 }));
    await waitFor(() => expect(result.current.waiting).toBe(1));
    expect(sent).toHaveLength(0);

    await goOnline();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.key).toMatch(/\S{8,}/);
    await waitFor(() => expect(result.current.waiting).toBe(0));
  });

  it('replay in the order they were made', async () => {
    const sent = captureWrites();
    const { result } = await renderWrite();
    await goOffline();

    await act(async () => {
      result.current.write.mutate({ n: 1 });
      result.current.write.mutate({ n: 2 });
      result.current.write.mutate({ n: 3 });
    });
    await waitFor(() => expect(result.current.waiting).toBe(3));

    await goOnline();
    await waitFor(() => expect(sent.map(write => write.n)).toEqual([1, 2, 3]));
    expect(new Set(sent.map(write => write.key)).size).toBe(3); // one key per write
  });

  it('survive the app being killed: saved with the cache, replayed with the same key', async () => {
    const sent = captureWrites();
    const { result, unmount } = await renderWrite();
    await goOffline();
    await act(async () => result.current.write.mutate({ n: 7 }));
    await waitFor(() => expect(result.current.waiting).toBe(1));
    const [queued] = queryClient.getMutationCache().getAll();
    const key = (queued?.state.variables as { idempotencyKey: string }).idempotencyKey;

    // "Kill" the app: save what the persister saves, wipe memory, restore on the next launch.
    const saved = JSON.parse(
      JSON.stringify(dehydrate(queryClient, createPersistOptions().dehydrateOptions)),
    );
    await unmount();
    queryClient.getMutationCache().clear();
    hydrate(queryClient, saved);
    expect(sent).toHaveLength(0);

    await goOnline();
    await act(() => resumeQueuedWrites());
    await waitFor(() => expect(sent).toEqual([{ n: 7, key }]));
  });
});

describe('queued writes and accounts', () => {
  let account: string | null = 'u_1';
  beforeEach(() => {
    account = 'u_1';
    setQueueAccount(() => account);
  });
  afterEach(() => setQueueAccount(() => null));

  it('record the account that made them', async () => {
    const { result } = await renderWrite();
    await goOffline();
    await act(async () => result.current.write.mutate({ n: 1 }));

    const [queued] = queryClient.getMutationCache().getAll();
    expect(queued?.state.variables).toMatchObject({ n: 1, accountId: 'u_1' });
  });

  it('are never sent once another account is signed in', async () => {
    const sent = captureWrites();
    const warn = jest.spyOn(services().logger, 'warn');
    const { result } = await renderWrite();
    await goOffline();
    await act(async () => result.current.write.mutate({ n: 1 }));
    await waitFor(() => expect(result.current.waiting).toBe(1));

    account = 'u_2'; // a different person signs in on the same device while the write waits
    await goOnline();

    await waitFor(() => expect(result.current.waiting).toBe(0));
    expect(sent).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('another account'),
      expect.anything(),
    );
  });

  it('are sent when the same account is still signed in', async () => {
    const sent = captureWrites();
    const { result } = await renderWrite();
    await goOffline();
    await act(async () => result.current.write.mutate({ n: 2 }));
    await goOnline();
    await waitFor(() => expect(sent.map(write => write.n)).toEqual([2]));
  });
});

describe('ordinary writes', () => {
  it('fail fast instead of waiting while offline (a sign-in never runs later by surprise)', async () => {
    await goOffline();
    const mutationFn = jest.fn(async () => 'done');
    const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn });

    await expect(mutation.execute(undefined)).resolves.toBe('done');
    expect(mutation.state.isPaused).toBe(false);
  });
});

describe('resumeQueuedWrites', () => {
  // Saved state for one paused write, as the persister stores it after the app is killed.
  const savedWrite = (mutationKey: string[], accountId?: string) => ({
    queries: [],
    mutations: [
      {
        mutationKey,
        scope: { id: JSON.stringify(mutationKey) },
        state: {
          context: undefined,
          data: undefined,
          error: null,
          failureCount: 0,
          failureReason: null,
          isPaused: true,
          status: 'pending' as const,
          variables: { n: 9, idempotencyKey: 'restored-key', accountId },
          submittedAt: 1,
        },
      },
    ],
  });

  it('replays a write whose definition was registered after the cache came back', async () => {
    // Metro's inlineRequires can load a feature's module after the cache is restored.
    hydrate(queryClient, savedWrite(['test', 'late']));
    const sent = captureWrites();
    defineQueuedMutation<{ ok: boolean }, { n: number }>({
      mutationKey: ['test', 'late'],
      mutationFn: ({ n, idempotencyKey }) =>
        http.post('/test-writes', z.object({ ok: z.boolean() }), { body: { n }, idempotencyKey }),
    });

    await act(() => resumeQueuedWrites());
    expect(sent).toEqual([{ n: 9, key: 'restored-key' }]);
  });

  it('drops and reports a write with no definition instead of failing silently', async () => {
    hydrate(queryClient, savedWrite(['test', 'unknown']));
    const error = jest.spyOn(services().logger, 'error');

    await act(() => resumeQueuedWrites());
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('src/app/queued-writes.ts'),
      expect.anything(),
    );
  });

  it("drops a saved write made by another account instead of sending it with this one's token", async () => {
    setQueueAccount(() => 'u_2');
    hydrate(queryClient, savedWrite(['test', 'write'], 'u_1'));
    const sent = captureWrites();

    await act(() => resumeQueuedWrites());
    expect(sent).toHaveLength(0);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    setQueueAccount(() => null);
  });

  it('replays a saved write of the signed-in account', async () => {
    setQueueAccount(() => 'u_1');
    hydrate(queryClient, savedWrite(['test', 'write'], 'u_1'));
    const sent = captureWrites();

    await act(() => resumeQueuedWrites());
    expect(sent).toEqual([{ n: 9, key: 'restored-key' }]);
    setQueueAccount(() => null);
  });
});
