import type { z } from 'zod';
import { create } from 'zustand';

import { ApiError } from '@/shared/api/errors';
import { http } from '@/shared/api/http';
import { services } from '@/shared/services/services';

/**
 * File uploads for queued writes (docs/uploads.md). An upload is part of a queued write: the write's
 * variables hold the kept file's id (`services().files.keep`), and its `mutationFn` calls
 * `uploadFile`. So an upload waits while offline, survives a restart, and is retried with the same
 * idempotency key, like any queued write.
 */

type ProgressState = { byKey: Record<string, number> };

/** Upload progress per write, 0–1. Small and in memory: it restarts from 0 after an app restart. */
const useProgressStore = create<ProgressState>(() => ({ byKey: {} }));

function setProgress(key: string, fraction: number) {
  useProgressStore.setState(state => ({ byKey: { ...state.byKey, [key]: fraction } }));
}

/** Forgets a write's progress once it's done or dropped. */
export function clearUploadProgress(key: string): void {
  useProgressStore.setState(state => ({
    byKey: Object.fromEntries(
      Object.entries(state.byKey).filter(([candidate]) => candidate !== key),
    ),
  }));
}

/** This write's upload progress (0–1), or undefined before any byte is sent. Re-renders only its caller. */
export function useUploadProgress(key: string | undefined): number | undefined {
  return useProgressStore(state => (key ? state.byKey[key] : undefined));
}

export type UploadFileOptions<S extends z.ZodType> = {
  url: string;
  schema: S;
  /** A file kept with `services().files.keep`. */
  fileId: string;
  mimeType: string;
  fileName: string;
  /** The multipart field name your API expects. */
  field?: string;
  /** Unique per upload; reused on every retry so the server stores the file once. */
  idempotencyKey: string;
  /** Reports progress under this key (usually the write's idempotency key). */
  progressKey: string;
  signal?: AbortSignal;
  /** Extra multipart fields, e.g. a caption. */
  fields?: Record<string, string>;
};

const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Sends a kept file as multipart/form-data and reports its progress. Throws an `ApiError` of kind
 * `'unknown'` (code `file_missing`) if the file was deleted, so the write fails instead of retrying.
 */
export async function uploadFile<S extends z.ZodType>(options: UploadFileOptions<S>) {
  const { files } = services();
  if (!(await files.exists(options.fileId))) {
    throw new ApiError('unknown', 'The file to upload is gone.', { code: 'file_missing' });
  }
  const form = new FormData();
  for (const [name, value] of Object.entries(options.fields ?? {})) form.append(name, value);
  // React Native's FormData sends a { uri, name, type } part as the file's bytes, streamed natively.
  form.append(options.field ?? 'file', {
    uri: files.uriOf(options.fileId),
    name: options.fileName,
    type: options.mimeType,
  } as unknown as Blob);

  setProgress(options.progressKey, 0);
  return http.post(options.url, options.schema, {
    body: form,
    idempotencyKey: options.idempotencyKey,
    signal: options.signal,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    onUploadProgress: fraction => setProgress(options.progressKey, fraction),
  });
}
