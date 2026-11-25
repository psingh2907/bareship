import { onlineManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';
import { http as mock, HttpResponse } from 'msw';
import { z } from 'zod';

import { server } from '@/mocks/node';
import { http } from '@/shared/api/http';
import { setServices } from '@/shared/services/services';
import { signInDemoUser } from '@/test/app';
import { renderHookWithProviders } from '@/test/render';

import { queueAccount } from './offline';
import { defineQueuedUpload, resetUploadRecords, uploadFile } from './uploads';

const Uploaded = z.object({ url: z.string() });

function fakeFiles(exists: boolean) {
  setServices({
    files: {
      keep: async () => 'kept.jpg',
      uriOf: id => `file:///documents/${id}`,
      exists: async () => exists,
      remove: async () => {},
    },
  });
}

const options = {
  url: '/uploads',
  schema: Uploaded,
  fileId: 'kept.jpg',
  mimeType: 'image/jpeg',
  fileName: 'photo.jpg',
  idempotencyKey: 'write-1:photo',
  progressKey: 'write-1',
};

describe('uploadFile', () => {
  beforeEach(async () => {
    await signInDemoUser();
  });

  it('sends the kept file with the idempotency key', async () => {
    fakeFiles(true);
    let key: string | null = null;
    server.use(
      mock.post('*/uploads', ({ request }) => {
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ url: 'https://cdn.example.com/1.jpg' }, { status: 201 });
      }),
    );
    await expect(uploadFile(options)).resolves.toEqual({ url: 'https://cdn.example.com/1.jpg' });
    expect(key).toBe('write-1:photo');
  });

  it('fails without retrying when the kept file is gone', async () => {
    fakeFiles(false);
    await expect(uploadFile(options)).rejects.toMatchObject({
      kind: 'unknown',
      details: { code: 'file_missing' },
    });
  });
});

describe('defineQueuedUpload', () => {
  const Photo = z.object({ id: z.string(), url: z.string() });
  // Module level in the app; defined once here for the tests.
  const useUploadThing = defineQueuedUpload<z.infer<typeof Photo>, { id: string }>({
    mutationKey: ['things', 'photo'],
    url: ({ id }) => `/things/${id}/photo`,
    schema: Photo,
  });

  const picked = {
    uri: 'file:///tmp/p.jpg',
    width: 100,
    height: 100,
    size: 1000,
    mimeType: 'image/jpeg',
    fileName: 'p.jpg',
  };

  function fakeMedia() {
    const removed: string[] = [];
    setServices({
      photos: { pick: async () => picked },
      files: {
        keep: async () => 'kept.jpg',
        uriOf: id => `file:///documents/${id}`,
        exists: async () => true,
        remove: async id => {
          removed.push(id);
        },
      },
    });
    return removed;
  }

  beforeEach(async () => {
    await signInDemoUser();
  });

  it('uploads a picked photo and clears its status once the server has it', async () => {
    const removed = fakeMedia();
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    server.use(
      mock.post('*/things/:id/photo', async () => {
        await held;
        return HttpResponse.json(
          { id: 'ph_1', url: 'https://cdn.example.com/1.jpg' },
          { status: 201 },
        );
      }),
    );
    const { result } = await renderHookWithProviders(() => useUploadThing());

    await act(async () => {
      await result.current.pick('library', { id: 't1' });
    });
    expect(result.current.status({ id: 't1' })).toMatchObject({
      state: 'uploading',
      localUri: 'file:///documents/kept.jpg',
    });

    await act(async () => release());
    await waitFor(() => expect(result.current.status({ id: 't1' })).toBeNull());
    expect(removed).toEqual(['kept.jpg']);
  });

  it('waits while offline, then uploads on reconnect', async () => {
    fakeMedia();
    server.use(
      mock.post('*/things/:id/photo', () =>
        HttpResponse.json({ id: 'ph_1', url: 'https://cdn.example.com/1.jpg' }, { status: 201 }),
      ),
    );
    const { result } = await renderHookWithProviders(() => useUploadThing());
    await act(async () => onlineManager.setOnline(false));

    await act(async () => {
      await result.current.pick('library', { id: 't1' });
    });
    expect(result.current.status({ id: 't1' })?.state).toBe('waiting');

    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.status({ id: 't1' })).toBeNull());
  });

  it('keeps a refused upload as failed until it is retried or removed', async () => {
    const removed = fakeMedia();
    const keys: Array<string | null> = [];
    let refuse = true;
    server.use(
      mock.post('*/things/:id/photo', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return refuse
          ? HttpResponse.json({ code: 'too_large', message: 'Too large.' }, { status: 413 })
          : HttpResponse.json(
              { id: 'ph_1', url: 'https://cdn.example.com/1.jpg' },
              { status: 201 },
            );
      }),
    );
    const { result } = await renderHookWithProviders(() => useUploadThing());

    await act(async () => {
      await result.current.pick('library', { id: 't1' });
    });
    await waitFor(() => expect(result.current.status({ id: 't1' })?.state).toBe('failed'));

    // Try again sends the same write, with the same key.
    refuse = false;
    await act(async () => result.current.status({ id: 't1' })?.retry());
    await waitFor(() => expect(result.current.status({ id: 't1' })).toBeNull());
    expect(new Set(keys).size).toBe(1);
    expect(removed).toEqual(['kept.jpg']);
  });

  it('shows an upload cut off when the app closed as failed, after a restart', async () => {
    fakeMedia();
    const { services } = jest.requireActual<typeof import('@/shared/services/services')>(
      '@/shared/services/services',
    );
    // What the last session saved: still sending, but the app closed before it finished (only
    // waiting writes are saved by the queue, so it's no longer queued).
    services().kv.set(
      'uploads.records',
      JSON.stringify({
        k1: {
          key: 'k1',
          group: JSON.stringify(['things', 'photo']),
          id: JSON.stringify({ id: 't1' }),
          accountId: queueAccount(),
          file: { fileId: 'kept.jpg', mimeType: 'image/jpeg', fileName: 'p.jpg' },
          state: 'sending',
          write: { id: 't1', idempotencyKey: 'k1', accountId: queueAccount() },
        },
      }),
    );
    resetUploadRecords();
    const { result } = await renderHookWithProviders(() => useUploadThing());
    expect(result.current.status({ id: 't1' })?.state).toBe('failed');
  });

  it('removes a failed upload and its kept file', async () => {
    const removed = fakeMedia();
    server.use(
      mock.post('*/things/:id/photo', () =>
        HttpResponse.json({ code: 'rejected', message: 'No.' }, { status: 422 }),
      ),
    );
    const { result } = await renderHookWithProviders(() => useUploadThing());
    await act(async () => {
      await result.current.pick('library', { id: 't1' });
    });
    await waitFor(() => expect(result.current.status({ id: 't1' })?.state).toBe('failed'));

    await act(async () => result.current.status({ id: 't1' })?.remove());
    expect(result.current.status({ id: 't1' })).toBeNull();
    expect(result.current.items).toEqual([]);
    expect(removed).toEqual(['kept.jpg']);
  });

  describe('with a second request (then)', () => {
    const Record = z.object({ id: z.string(), photoUrl: z.string().nullable() });
    const useCreateThing = defineQueuedUpload({
      mutationKey: ['things', 'create'],
      url: (_thing: { thingId: string }) => '/things-uploads',
      schema: Photo,
      id: ({ thingId }) => thingId,
      then: (uploaded, { thingId }, { idempotencyKey, signal }) =>
        http.post('/things', Record, {
          body: { id: thingId, photo_url: uploaded?.url ?? null },
          idempotencyKey,
          signal,
        }),
    });

    it('uploads, then sends the record with the photo URL and the write key', async () => {
      fakeMedia();
      const calls: Array<{ path: string; key: string | null; body?: unknown }> = [];
      server.use(
        mock.post('*/things-uploads', ({ request }) => {
          calls.push({ path: 'upload', key: request.headers.get('Idempotency-Key') });
          return HttpResponse.json(
            { id: 'ph_1', url: 'https://cdn.example.com/1.jpg' },
            { status: 201 },
          );
        }),
        mock.post('*/things', async ({ request }) => {
          const body = (await request.json()) as { id: string; photo_url: string | null };
          calls.push({ path: 'record', key: request.headers.get('Idempotency-Key'), body });
          return HttpResponse.json({ id: body.id, photoUrl: body.photo_url }, { status: 201 });
        }),
      );
      const { result } = await renderHookWithProviders(() => useCreateThing());
      await act(async () => {
        await result.current.start(picked, { thingId: 't1' });
      });
      await waitFor(() => expect(result.current.status({ thingId: 't1' })).toBeNull());

      expect(calls.map(call => call.path)).toEqual(['upload', 'record']);
      expect(calls[1]?.body).toEqual({ id: 't1', photo_url: 'https://cdn.example.com/1.jpg' });
      // The record uses the write's key; the upload has its own, derived from it.
      expect(calls[0]?.key).toBe(`${calls[1]?.key}:upload`);
    });

    it('skips the upload when there is no photo', async () => {
      fakeMedia();
      const paths: string[] = [];
      server.use(
        mock.post('*/things-uploads', () => {
          paths.push('upload');
          return HttpResponse.json(
            { id: 'x', url: 'https://cdn.example.com/x.jpg' },
            { status: 201 },
          );
        }),
        mock.post('*/things', () => {
          paths.push('record');
          return HttpResponse.json({ id: 't2', photoUrl: null }, { status: 201 });
        }),
      );
      const { result } = await renderHookWithProviders(() => useCreateThing());
      await act(async () => {
        await result.current.start(null, { thingId: 't2' });
      });
      await waitFor(() => expect(result.current.status({ thingId: 't2' })).toBeNull());
      expect(paths).toEqual(['record']);
    });
  });
});
