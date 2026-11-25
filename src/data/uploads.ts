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

/** What a screen shows for one unfinished upload. */
export type UploadItem<TVariables = Record<string, string>> = {
  /** The item it belongs to (`id` option; the variables as JSON by default). */
  id: string;
  /** What was passed to `pick` or `start`, e.g. to show an unsent record in a list. */
  variables: TVariables;
  /**
   * The write's idempotency key. Read its progress with `useUploadProgress(key)` in the component that
   * shows it, so progress events re-render that component only.
   */
  key: string;
  state: 'uploading' | 'waiting' | 'failed';
  /** The photo on the phone, to show before the server has it. Null when there's no file. */
  localUri: string | null;
  retry: () => void;
  /** Stops it, takes it out of the queue, deletes the kept file and calls `onRemove`. */
  remove: () => void;
};

type UploadRecord = {
  key: string;
  /** The upload's mutation key, as JSON. */
  group: string;
  id: string;
  accountId: string | null;
  file: KeptFile | null;
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

/** Variables as JSON with sorted keys, so `{ a, b }` and `{ b, a }` match. */
const defaultId = (variables: object) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b))),
  );

const forgetFile = (file: KeptFile | null) =>
  file
    ? services()
        .files.remove(file.fileId)
        .catch(() => {})
    : Promise.resolve();

export type QueuedUploadOptions<TUpload, TVariables extends Record<string, string>, TData> = {
  /** Names the upload in the saved queue. Keep it stable across app versions. */
  mutationKey: MutationKey;
  /** Where to send the file, from the item's variables. */
  url: (variables: TVariables) => string;
  /** Validates and types the upload's response. */
  schema: z.ZodType<TUpload>;
  /** The multipart field your API expects. Default `file`. */
  field?: string;
  /** Photo size for `pick`. Default 2048 px on the long side, JPEG quality 0.8. */
  photo?: { maxSize?: number; quality?: number };
  /** Identifies the item an upload belongs to, for `status`. Default: all its variables. */
  id?: (variables: TVariables) => string;
  /**
   * A second request after the upload, e.g. create the post that uses the photo's URL. It gets the
   * upload's result (null when there was no file), the item and the write's idempotency key and abort
   * signal: pass both on, so a retry is never applied twice and Remove stops it.
   */
  then?: (
    uploaded: TUpload | null,
    variables: TVariables,
    request: { idempotencyKey: string; signal: AbortSignal },
  ) => Promise<TData>;
  /** Runs when the upload is queued (and on retry): show the item at once. */
  onMutate?: (variables: TVariables, localUri: string | null) => unknown;
  /** The server has it: update the cache from the response. */
  onSuccess?: (data: TData, variables: TVariables) => unknown;
  /** The server refused it for good; the item already shows as failed. */
  onError?: (error: ApiError, variables: TVariables) => unknown;
  /** The person removed it (or cancelled it mid-upload): undo what `onMutate` showed. */
  onRemove?: (variables: TVariables) => unknown;
};

/**
 * A photo upload that works offline (docs/uploads.md): a queued write (ADR 0006) whose variables
 * hold a kept file. It waits while offline, survives a restart, waits again if the connection
 * drops mid-upload, and retries with one idempotency key, so the server stores the file once.
 * A refused upload stays as failed, with retry and remove, until the person acts.
 *
 * Call at module level and import the module from src/app/queued-writes.ts, like any queued write.
 *
 *   export const useUploadReceiptPhoto = defineQueuedUpload({
 *     mutationKey: ['receipts', 'receipt-photo'],
 *     url: ({ id }: { id: string }) => `/receipts/${encodeURIComponent(id)}/photo`,
 *     schema: ReceiptPhotoSchema,
 *   });
 *
 * With `then`, the upload is the first of two requests: upload a photo, then create the record that
 * uses it (the demo's `useCreatePost`). Without a file, only `then` runs.
 */
export function defineQueuedUpload<
  TUpload,
  TVariables extends Record<string, string>,
  TData = TUpload,
>(options: QueuedUploadOptions<TUpload, TVariables, TData>) {
  const { mutationKey, url, schema, field, photo: photoOptions, then } = options;
  const { onMutate, onSuccess, onError, onRemove } = options;
  const group = JSON.stringify(mutationKey);
  const idOf = options.id ?? defaultId;
  type Variables = TVariables & { file: KeptFile | null };
  const item = ({
    file: _file,
    idempotencyKey: _key,
    accountId: _account,
    ...rest
  }: Queued<Variables>) => rest as unknown as TVariables;
  const localUri = (file: KeptFile | null) => (file ? services().files.uriOf(file.fileId) : null);

  const useWrite = defineQueuedMutation<TData, Variables>({
    mutationKey,
    // A dropped connection waits for it to come back instead of failing.
    retry: (failureCount, error) => error.isTransient && failureCount < 20,
    mutationFn: async variables => {
      const { idempotencyKey, file } = variables;
      const signal = writeSignal(idempotencyKey);
      try {
        const uploaded = file
          ? await uploadFile({
              url: url(item(variables)),
              schema,
              fileId: file.fileId,
              mimeType: file.mimeType,
              fileName: file.fileName,
              field,
              // Its own key when a second request follows, which uses the write's key.
              idempotencyKey: then ? `${idempotencyKey}:upload` : idempotencyKey,
              progressKey: idempotencyKey,
              signal,
            })
          : null;
        return then
          ? await then(uploaded, item(variables), { idempotencyKey, signal })
          : (uploaded as TData);
      } finally {
        releaseWriteSignal(idempotencyKey);
      }
    },
    onMutate: variables => {
      const id = idOf(item(variables));
      saveRecords(byKey => ({
        // A new upload for the same item replaces an old one.
        ...Object.fromEntries(
          Object.entries(byKey).filter(
            ([, record]) =>
              !(
                record.group === group &&
                record.id === id &&
                record.key !== variables.idempotencyKey
              ),
          ),
        ),
        [variables.idempotencyKey]: {
          key: variables.idempotencyKey,
          group,
          id,
          accountId: variables.accountId ?? null,
          file: variables.file,
          state: 'sending',
          write: variables,
        },
      }));
      return onMutate?.(item(variables), localUri(variables.file));
    },
    onError: (error, variables) => {
      clearUploadProgress(variables.idempotencyKey);
      if (error.kind === 'cancelled') {
        dropRecord(variables.idempotencyKey);
        forgetFile(variables.file);
        return onRemove?.(item(variables));
      }
      saveRecords(byKey => {
        const record = byKey[variables.idempotencyKey];
        return record
          ? { ...byKey, [variables.idempotencyKey]: { ...record, state: 'failed' } }
          : byKey;
      });
      return onError?.(error, item(variables));
    },
    onSuccess: (data, variables) => {
      clearUploadProgress(variables.idempotencyKey);
      dropRecord(variables.idempotencyKey);
      // The server has its own copy now. (The mock backend serves the file from the phone, so it's
      // kept when the response points at it.)
      const uri = localUri(variables.file);
      if (uri && !JSON.stringify(data).includes(uri)) forgetFile(variables.file);
      return onSuccess?.(data, item(variables));
    },
  });

  return function useQueuedUpload() {
    loadRecords();
    const write = useWrite();
    const records = useRecords(state => state.byKey);
    const pending = usePendingWriteKeys(mutationKey);
    const waiting = new Set(
      useWaitingWrites<Variables>(mutationKey).map(variables => variables.idempotencyKey),
    );
    const account = queueAccount();

    const toItem = (record: UploadRecord): UploadItem<TVariables> => ({
      id: record.id,
      variables: item(record.write as Queued<Variables>),
      key: record.key,
      // Still "sending" but no longer queued: it was cut off when the app closed.
      state:
        record.state === 'failed' || !pending.has(record.key)
          ? 'failed'
          : waiting.has(record.key)
            ? 'waiting'
            : 'uploading',
      localUri: localUri(record.file),
      retry: () => write.resend(record.write as Queued<Variables>),
      remove: () => {
        discardQueuedWrite(record.key);
        clearUploadProgress(record.key);
        dropRecord(record.key);
        forgetFile(record.file);
        onRemove?.(item(record.write as Queued<Variables>));
      },
    });

    const items = Object.values(records)
      .filter(record => record.group === group && record.accountId === account)
      .map(toItem);

    /**
     * Keeps a photo you already have (from your own picker; null for none) and queues the write.
     * Rejects if the photo can't be kept.
     */
    const start = async (picked: PickedPhoto | null, variables: TVariables) => {
      const file = picked
        ? {
            fileId: await services().files.keep(picked.uri),
            mimeType: picked.mimeType,
            fileName: picked.fileName,
          }
        : null;
      write.mutate({ ...variables, file } as Variables);
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
      status: (variables: TVariables): UploadItem<TVariables> | null =>
        items.find(candidate => candidate.id === idOf(variables)) ?? null,
      /** Every unfinished upload of this kind, for this account. */
      items,
    };
  };
}
