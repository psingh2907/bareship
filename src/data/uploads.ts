import type { MutationKey } from '@tanstack/react-query';
import type { z } from 'zod';
import { create } from 'zustand';

import { ApiError } from '@/shared/api/errors';
import { http } from '@/shared/api/http';
import type { PhotoSource, PickedPhoto } from '@/shared/ports';
import { services } from '@/shared/services/services';

import {
  defineQueuedMutation,
  discardQueuedWrite,
  queueAccount,
  type Queued,
  releaseWriteSignal,
  usePendingWriteKeys,
  useWaitingWrites,
  writeSignal,
} from './offline';

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

// ------------------------------------------------------------------------------- queued uploads

/** A file kept with `services().files.keep`, ready to upload. */
export type KeptFile = { fileId: string; mimeType: string; fileName: string };

/** What a screen shows for one upload. */
export type UploadItem = {
  /** The write's idempotency key: pass it to `useUploadProgress` in a list row. */
  key: string;
  state: 'uploading' | 'waiting' | 'failed';
  /** 0–1 while uploading. */
  progress: number | undefined;
  /** The photo on the phone, to show before the server has it. */
  localUri: string;
  retry: () => void;
  /** Stops it, takes it out of the queue, and deletes the kept file. */
  remove: () => void;
};

type UploadRecord = {
  key: string;
  /** The upload's mutation key, as JSON. */
  group: string;
  /** The item it belongs to (its variables), as JSON. */
  item: string;
  accountId: string | null;
  file: KeptFile;
  /** `sending` until it succeeds; `failed` once the server refused it. */
  state: 'sending' | 'failed';
  /** The queued write's variables, to send it again with the same key. */
  write: Record<string, unknown>;
};

const RECORDS_KEY = 'uploads.records';

/**
 * One record per upload that hasn't finished, saved to the key-value store, so a failed upload (or
 * one cut off when the app closed) still shows, with Try again, after a restart. The upload itself is
 * saved by the offline queue while it waits.
 */
const useRecords = create<{ byKey: Record<string, UploadRecord> }>(() => ({ byKey: {} }));
let recordsLoaded = false;

function loadRecords() {
  if (recordsLoaded) return;
  recordsLoaded = true;
  const saved = services().kv.getString(RECORDS_KEY);
  if (!saved) return;
  try {
    useRecords.setState({ byKey: JSON.parse(saved) as Record<string, UploadRecord> });
  } catch {
    services().kv.remove(RECORDS_KEY);
  }
}

function saveRecords(
  update: (byKey: Record<string, UploadRecord>) => Record<string, UploadRecord>,
) {
  loadRecords();
  const byKey = update(useRecords.getState().byKey);
  useRecords.setState({ byKey });
  services().kv.set(RECORDS_KEY, JSON.stringify(byKey));
}

const dropRecord = (key: string) =>
  saveRecords(byKey => Object.fromEntries(Object.entries(byKey).filter(([k]) => k !== key)));

/** Test helper: forget the in-memory records (the key-value store is reset separately). */
export function resetUploadRecords(): void {
  recordsLoaded = false;
  useRecords.setState({ byKey: {} });
}

/** Item variables, as JSON with sorted keys, so `{ a, b }` and `{ b, a }` match. */
const itemId = (variables: object) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b))),
  );

const forgetFile = (fileId: string) =>
  services()
    .files.remove(fileId)
    .catch(() => {});

export type QueuedUploadOptions<TData, TVariables extends Record<string, string>> = {
  /** Names the upload in the saved queue. Keep it stable across app versions. */
  mutationKey: MutationKey;
  /** Where to send the file, from the item's variables. */
  url: (variables: TVariables) => string;
  /** Validates and types the server's response. */
  schema: z.ZodType<TData>;
  /** The multipart field your API expects. Default `file`. */
  field?: string;
  /** Photo size for `pick`. Default 2048 px on the long side, JPEG quality 0.8. */
  photo?: { maxSize?: number; quality?: number };
  /** Update the cache from the response (it's the server's copy now). */
  onSuccess?: (data: TData, variables: TVariables) => unknown;
  /** Called when the server refuses it for good (not when the person removes it). */
  onError?: (error: ApiError, variables: TVariables) => unknown;
};

/**
 * A photo upload that works offline (docs/uploads.md): a queued write (ADR 0006) whose variables
 * hold a kept file. It waits while offline, survives a restart, waits again if the connection
 * drops mid-upload, and retries with one idempotency key, so the server stores the file once.
 * A refused upload stays as failed, with retry and remove, until the person acts.
 *
 * Call at module level and import the module from src/app/queued-writes.ts, like any queued write.
 *
 *   export const useUploadReceiptPhoto = defineQueuedUpload<ReceiptPhoto, { id: string }>({
 *     mutationKey: ['receipts', 'receipt-photo'],
 *     url: ({ id }) => `/receipts/${encodeURIComponent(id)}/photo`,
 *     schema: ReceiptPhotoSchema,
 *   });
 */
export function defineQueuedUpload<TData, TVariables extends Record<string, string>>(
  options: QueuedUploadOptions<TData, TVariables>,
) {
  const { mutationKey, url, schema, field, photo: photoOptions, onSuccess, onError } = options;
  const group = JSON.stringify(mutationKey);
  type Variables = TVariables & { file: KeptFile };
  const strip = ({
    file: _file,
    idempotencyKey: _key,
    accountId: _account,
    ...rest
  }: Queued<Variables>) => rest as unknown as TVariables;

  const useWrite = defineQueuedMutation<TData, Variables>({
    mutationKey,
    // A dropped connection waits for it to come back instead of failing.
    retry: (failureCount, error) => error.isTransient && failureCount < 20,
    mutationFn: async variables => {
      const signal = writeSignal(variables.idempotencyKey);
      try {
        return await uploadFile({
          url: url(strip(variables)),
          schema,
          fileId: variables.file.fileId,
          mimeType: variables.file.mimeType,
          fileName: variables.file.fileName,
          field,
          idempotencyKey: variables.idempotencyKey,
          progressKey: variables.idempotencyKey,
          signal,
        });
      } finally {
        releaseWriteSignal(variables.idempotencyKey);
      }
    },
    onMutate: variables => {
      const item = strip(variables);
      saveRecords(byKey => ({
        // A new upload for the same item replaces an old failed one.
        ...Object.fromEntries(
          Object.entries(byKey).filter(
            ([, record]) =>
              !(
                record.group === group &&
                record.item === itemId(item) &&
                record.key !== variables.idempotencyKey
              ),
          ),
        ),
        [variables.idempotencyKey]: {
          key: variables.idempotencyKey,
          group,
          item: itemId(item),
          accountId: variables.accountId ?? null,
          file: variables.file,
          state: 'sending',
          write: variables,
        },
      }));
    },
    onError: (error, variables) => {
      clearUploadProgress(variables.idempotencyKey);
      if (error.kind === 'cancelled') {
        dropRecord(variables.idempotencyKey);
        forgetFile(variables.file.fileId);
        return;
      }
      saveRecords(byKey => {
        const record = byKey[variables.idempotencyKey];
        return record
          ? { ...byKey, [variables.idempotencyKey]: { ...record, state: 'failed' } }
          : byKey;
      });
      return onError?.(error, strip(variables));
    },
    onSuccess: (data, variables) => {
      clearUploadProgress(variables.idempotencyKey);
      dropRecord(variables.idempotencyKey);
      // The server has its own copy now. (The mock backend serves the file from the phone, so it's
      // kept when the response points at it.)
      if (!JSON.stringify(data).includes(services().files.uriOf(variables.file.fileId))) {
        forgetFile(variables.file.fileId);
      }
      return onSuccess?.(data, strip(variables));
    },
  });

  return function useQueuedUpload() {
    loadRecords();
    const write = useWrite();
    const records = useRecords(state => state.byKey);
    const pending = usePendingWriteKeys(mutationKey);
    const waiting = new Set(useWaitingWrites<Variables>(mutationKey).map(w => w.idempotencyKey));
    const progress = useProgressStore(state => state.byKey);
    const account = queueAccount();

    const toItem = (record: UploadRecord): UploadItem => ({
      key: record.key,
      // Still "sending" but no longer queued: it was cut off when the app closed.
      state:
        record.state === 'failed' || !pending.has(record.key)
          ? 'failed'
          : waiting.has(record.key)
            ? 'waiting'
            : 'uploading',
      progress: progress[record.key],
      localUri: services().files.uriOf(record.file.fileId),
      retry: () => write.resend(record.write as Queued<Variables>),
      remove: () => {
        discardQueuedWrite(record.key);
        clearUploadProgress(record.key);
        dropRecord(record.key);
        forgetFile(record.file.fileId);
      },
    });

    const mine = Object.values(records).filter(
      record => record.group === group && record.accountId === account,
    );

    /** Keeps a photo you already have (from your own picker) and queues its upload. */
    const start = async (picked: PickedPhoto, variables: TVariables) => {
      const fileId = await services().files.keep(picked.uri);
      write.mutate({
        ...variables,
        file: { fileId, mimeType: picked.mimeType, fileName: picked.fileName },
      } as Variables);
    };

    return {
      /**
       * Picks a photo (the system picker, or the camera: ask with `usePermission('camera')` first),
       * keeps it and queues the upload. Resolves false when the person cancels.
       */
      pick: async (source: PhotoSource, variables: TVariables) => {
        const picked = await services().photos.pick(source, photoOptions);
        if (!picked) return false;
        await start(picked, variables);
        return true;
      },
      start,
      /** This item's unfinished upload, or null when there's none (or it's done). */
      status: (variables: TVariables): UploadItem | null => {
        const record = mine.find(candidate => candidate.item === itemId(variables));
        return record ? toItem(record) : null;
      },
      /** Every unfinished upload of this kind, for this account. */
      items: mine.map(toItem),
    };
  };
}
