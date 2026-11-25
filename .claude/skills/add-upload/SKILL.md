---
name: add-upload
description: Adds a photo upload that works offline to a feature of this template - pnpm gen upload writes the queued upload hook (defineQueuedUpload), the response schema, a mock handler and tests. Use when asked to let people attach, upload or send a photo, image, picture, receipt, avatar or document scan.
---

# Add an upload

## 1. Generate

```bash
pnpm gen upload <feature> <name> --path /receipts/:id/photo
```

`--path` defaults to `/<feature>/:id/<name>`; each `:param` becomes a field the screen passes. It writes:

| Where | What |
| --- | --- |
| `schema.ts` | `<Name>DtoSchema`, the `<Name>` model (`{ id, url }`) and `<Name>Schema` |
| `api.ts` | `useUpload<Name>`, a `defineQueuedUpload` (works offline, one idempotency key per upload) |
| `index.ts` | Exports it, for `src/app` |
| `src/app/queued-writes.ts` | Imports the feature's `api` module, so a waiting upload replays after a restart |
| `src/mocks/<feature>.ts` | A handler that accepts the upload |
| `src/features/<feature>/<name>.test.tsx` | Online, offline and refused cases |

## 2. Use it in a screen

```tsx
const upload = useUploadReceiptPhoto();
const camera = usePermission('camera', { onGranted: () => upload.pick('camera', { id }) });
const item = upload.status({ id });
const progress = useUploadProgress(item?.key);

<Button title={t('receipts.addPhoto')} icon={ImagePlus} onPress={() => upload.pick('library', { id })} />
{camera.status !== 'unavailable' ? (
  <Button title={t('receipts.takePhoto')} icon={Camera} onPress={camera.ask} />
) : null}
{item ? (
  <>
    <Image uri={item.localUri} style={styles.photo} />
    <UploadStatus state={item.state} progress={progress} onRetry={item.retry} onRemove={item.remove} />
  </>
) : null}
<PermissionSheet {...camera.sheet} />
```

- `pick(source, item)` picks, keeps the file and queues the upload. `start(photo, item)` does the same for a
  photo the screen already has.
- `status(item)` is null when there's nothing unfinished. Show the server's URL from your own data once it's
  done (update it in `onSuccess`).
- Progress comes from `useUploadProgress(item?.key)`, not the hook, so progress events re-render only the
  component that reads it. In a list, read it in the row component.
- Strings go in `en.json` and `hi.json`; `<UploadStatus>` already has its own.

## 3. Make it real

1. **Response.** Add the fields your API returns to the DTO, model and transform.
2. **Cache.** Pass `onSuccess: (photo, item) => queryClient.setQueryData(…)` so the screen shows the stored
   photo. `onError` runs when the server refuses it; the item already shows as failed.
3. **Size.** `photo: { maxSize, quality }` sets how much the photo is resized (default 2048 px, 0.8).
4. **Mock.** Make the handler behave like your server, including `error(status, code, message)` refusals.
   Your backend must honour the `Idempotency-Key` header ([docs/uploads.md](../../../docs/uploads.md)).
5. **Two requests** (upload, then create a record with its URL): add `then: (uploaded, item, { idempotencyKey,
   signal }) => http.post(…)` and pass both on. Add `onMutate` / `onRemove` to show the record at once and
   take it away again, and `id` so `status` finds it by your record's id. A record without a photo goes
   through `start(null, item)`, which skips the upload. The demo's `useCreatePost`
   (`src/features/feed/api.ts`) does exactly this.

## 4. Check

```bash
pnpm check
```
