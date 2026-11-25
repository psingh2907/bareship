# Photo uploads

People can add a photo to a post from their library or their camera. The post shows in the feed at once,
with the upload's progress, and the upload works like every other offline write:

- **Offline**, it waits ("Waiting to upload"), survives the app being closed, and goes out when the phone
  reconnects.
- **If the connection drops mid-upload**, it waits again instead of failing.
- **If the server refuses it**, the post stays in the feed as failed, with **Try again** and **Remove**.
- **A retry never stores the photo twice**: every attempt sends the same idempotency key.

<p align="center">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/10-upload-waiting.png" alt="Android, offline: a new post with its photo, marked Waiting to upload, under a banner saying one change will sync" width="240">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/10-upload-failed.png" alt="iOS: a post the server refused, with Couldn't upload this, Try again and Remove" width="240">
</p>

Photos are resized natively to at most 2048 px on the long side and saved as JPEG (iPhone HEIC photos
included), so an upload is a few hundred KB rather than several MB.

The demo feed uses it: tap the pen in the feed's header to write a post. `pnpm strip-examples` removes the
demo; the building blocks below stay.

## The building blocks

| Piece | Where | What it does |
| --- | --- | --- |
| `services().photos.pick(source)` | `PhotoPicker` port | Opens the system photo picker (no permission needed) or the camera, and returns a resized JPEG in a temporary file |
| `usePermission('camera', { onGranted })` | `entities/permissions` | Explains the camera before the system prompt, then opens it ([permissions](permissions.md)) |
| `services().files.keep(uri)` | `FileStore` port | Copies the photo where the system won't delete it, and returns an id |
| `uploadFile({ fileId, … })` | `data/uploads.ts` | Sends a kept file as `multipart/form-data` and reports its progress |
| `useUploadProgress(key)` | `data/uploads.ts` | One upload's progress (0–1); re-renders only the component that reads it |
| `discardQueuedWrite(key)`, `resend(variables)` | `data/offline.ts` | Remove a waiting or running write; send a failed one again with its original key |
| `<UploadStatus>` | `shared/ui/upload` | The progress bar, "Waiting to upload", and Try again / Remove |

Save the id `files.keep` returns, not a path: iOS moves the app's folder when the app is updated.

## Upload from your own screen

Make the upload part of a queued write (offline pattern B, ADR 0006): the write's variables hold the kept
file's id, and its `mutationFn` calls `uploadFile`. `useCreatePost` in `src/features/feed/api.ts` is the
complete example; the core is:

```ts
export const useSendReceipt = defineQueuedMutation<Receipt, { receiptId: string; photo: NewPhoto }>({
  mutationKey: ['receipts', 'send'],
  // A dropped connection waits for it to come back instead of failing.
  retry: (failureCount, error) => error.isTransient && failureCount < 20,
  mutationFn: async ({ receiptId, photo, idempotencyKey }) => {
    const signal = writeSignal(idempotencyKey); // lets Remove stop it mid-upload
    try {
      const { url } = await uploadFile({
        url: '/uploads',
        schema: UploadSchema,
        fileId: photo.fileId,
        mimeType: photo.mimeType,
        fileName: photo.fileName,
        idempotencyKey: `${idempotencyKey}:photo`,
        progressKey: idempotencyKey,
        signal,
      });
      return await http.post('/receipts', ReceiptSchema, {
        body: { id: receiptId, image_url: url },
        idempotencyKey,
        signal,
      });
    } finally {
      releaseWriteSignal(idempotencyKey);
    }
  },
  onMutate: …, // show it at once
  onError: …,  // kind 'cancelled': the person removed it; anything else: show it as failed
  onSuccess: …, // swap in the server's copy, then services().files.remove(photo.fileId)
});
```

Import the module from `src/app/queued-writes.ts`, like every queued write.

On screen, pick, keep, then write:

```ts
const picked = await services().photos.pick('library');
if (picked) {
  const fileId = await services().files.keep(picked.uri);
  sendReceipt.mutate({ receiptId: createId(), photo: { fileId, mimeType: picked.mimeType, fileName: picked.fileName } });
}
```

Show its state with `<UploadStatus state={…} progress={useUploadProgress(key)} … />`. Read the progress in
a small component of its own, so progress events re-render that row and not the whole list.

## What your backend needs

The app sends two requests, each with an `Idempotency-Key` header that stays the same on every retry:

1. `POST /uploads`, `multipart/form-data` with the photo in a `file` field. It returns `{ "id", "url" }`.
   If it has already seen the key, it returns the first response instead of storing the file again.
2. `POST /posts` (or your own resource) with the returned `url` and an id the app chose, so a replay
   doesn't create a second post.

Other ways to store files, with the same app code around them:

- **S3, R2 or Google Cloud Storage with a presigned URL:** ask your API for an upload URL first, `PUT` the
  file there, then send the URL with the post. Make the presign request part of the same `mutationFn`.
- **Firebase Storage:** upload in the `mutationFn` with `@react-native-firebase/storage` behind a port, and
  report its progress with the same store.

The mock backend accepts uploads, so all of this works with no server. In development it "stores" the photo
as the kept file on the phone. A post containing `#fail` is refused, to show the failed state.

## Limits

- Waiting uploads are saved with the query cache for 24 hours (`maxAge` in `src/data/persister.ts`).
- An upload that was running when the app was closed shows as failed, with Try again: only waiting writes
  are saved.
- Uploads run while the app is open. They don't continue in the background after it's closed.
- One photo per post. For several, keep each one and upload them in the same `mutationFn`.

## Native setup

| Library | Why |
| --- | --- |
| `react-native-image-picker` | System photo picker and camera, with native resizing |
| `react-native-file-access` | Keeps photos in the app's documents folder until they're uploaded |
| `react-native-permissions` | The camera's permission state on iOS (Android needs none) |

iOS needs `NSCameraUsageDescription` in `Info.plist`; Android declares no new permission, because the
photo is taken by the system camera app. See [native changes](native-changes.md#photo-uploads).
