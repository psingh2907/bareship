import { http as mock, HttpResponse } from 'msw';
import { z } from 'zod';

import { server } from '@/mocks/node';
import { setServices } from '@/shared/services/services';
import { signInDemoUser } from '@/test/app';

import { uploadFile } from './uploads';

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
