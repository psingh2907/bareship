import {
  type InfiniteData,
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
} from '@tanstack/react-query';

import {
  defineQueuedMutation,
  discardQueuedWrite,
  hasLaterWrite,
  releaseWriteSignal,
  usePendingWriteKeys,
  useWaitingWrites,
  writeSignal,
} from '@/data/offline';
import { queryClient } from '@/data/query-client';
import { clearUploadProgress, uploadFile } from '@/data/uploads';
import { useSession } from '@/entities/session/session-store';
import { http } from '@/shared/api/http';
import { type CursorPage, nextCursor } from '@/shared/api/pagination';
import { i18n } from '@/shared/i18n';
import type { PhotoSource, PickedPhoto } from '@/shared/ports';
import { services } from '@/shared/services/services';
import { preloadImages } from '@/shared/ui/primitives/Image';
import { toast } from '@/shared/ui/toast/toast-store';

import {
  type CreatePostVariables,
  FeedPageSchema,
  type NewPhoto,
  type Post,
  PostSchema,
  UploadSchema,
} from './schema';

const PAGE_SIZE = 10;

export const postKeys = {
  all: ['posts'] as const,
  feed: () => [...postKeys.all, 'feed'] as const,
  detail: (id: string) => [...postKeys.all, 'detail', id] as const,
};

export const feedQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: postKeys.feed(),
    queryFn: async ({ pageParam, signal }) => {
      const page = await http.get('/posts', FeedPageSchema, {
        params: { cursor: pageParam, limit: PAGE_SIZE },
        signal,
      });
      preloadImages(page.items.flatMap(post => (post.imageUrl ? [post.imageUrl] : [])));
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    // Cap what is kept in memory and in the persisted cache.
    maxPages: 10,
  });

export const postQueryOptions = (id: string, client?: QueryClient) =>
  queryOptions({
    queryKey: postKeys.detail(id),
    queryFn: ({ signal }) => http.get(`/posts/${encodeURIComponent(id)}`, PostSchema, { signal }),
    // Show the copy already in the feed instantly while the detail loads.
    initialData: () => (client ? findInFeed(client, id) : undefined),
    initialDataUpdatedAt: () => client?.getQueryState(postKeys.feed())?.dataUpdatedAt,
  });

function findInFeed(client: QueryClient, id: string): Post | undefined {
  const feed = client.getQueryData<InfiniteData<CursorPage<Post>>>(postKeys.feed());
  return feed?.pages.flatMap(page => page.items).find(post => post.id === id);
}

/** Applies `update` to every cached copy of a post (feed pages and detail). */
function updatePost(client: QueryClient, id: string, update: (post: Post) => Post) {
  client.setQueryData<InfiniteData<CursorPage<Post>>>(postKeys.feed(), feed =>
    feed
      ? {
          ...feed,
          pages: feed.pages.map(page => ({
            ...page,
            items: page.items.map(post => (post.id === id ? update(post) : post)),
          })),
        }
      : feed,
  );
  client.setQueryData<Post>(postKeys.detail(id), post => (post ? update(post) : post));
}

export type LikeVariables = { postId: string; like: boolean };

const likeKey = ['posts', 'like'] as const;

const applyLike = (like: boolean) => (post: Post) =>
  post.likedByMe === like
    ? post
    : { ...post, likedByMe: like, likeCount: post.likeCount + (like ? 1 : -1) };

/**
 * Like / unlike: a queued write with an optimistic update (offline pattern B, ADR 0006).
 * The UI changes at once and works offline: the write waits for a connection, survives a restart,
 * and the card shows it as waiting (`useWaitingLikes`). On failure it rolls back with a toast.
 */
export const useToggleLike = defineQueuedMutation<Post, LikeVariables>({
  mutationKey: likeKey,
  mutationFn: ({ postId, like, idempotencyKey }) => {
    const url = `/posts/${encodeURIComponent(postId)}/like`;
    return like
      ? http.post(url, PostSchema, { idempotencyKey })
      : http.delete(url, PostSchema, { idempotencyKey });
  },
  onMutate: async ({ postId, like }) => {
    await queryClient.cancelQueries({ queryKey: postKeys.all });
    updatePost(queryClient, postId, applyLike(like));
  },
  onError: (_error, { postId, like }) => {
    updatePost(queryClient, postId, applyLike(!like));
    toast.error(i18n.t('feed.likeFailed'));
  },
  onSuccess: (updated, { postId }) => {
    // A like then an unlike queued offline: keep the optimistic state until the last one lands.
    if (hasLaterWrite<LikeVariables>(likeKey, variables => variables.postId === postId)) return;
    updatePost(queryClient, updated.id, () => updated);
  },
});

/** Ids of posts whose like is waiting for a connection. */
export function useWaitingLikes(): ReadonlySet<string> {
  const waiting = useWaitingWrites<LikeVariables>(likeKey);
  return new Set(waiting.map(variables => variables.postId));
}

const createPostKey = ['posts', 'create'] as const;

const PHOTO_MAX_SIZE = 2048;

/** Adds a post at the top of the feed's first page. */
function addToFeed(client: QueryClient, post: Post) {
  client.setQueryData<InfiniteData<CursorPage<Post>>>(postKeys.feed(), feed =>
    feed
      ? {
          ...feed,
          pages: feed.pages.map((page, index) =>
            index === 0
              ? { ...page, items: [post, ...page.items.filter(p => p.id !== post.id)] }
              : page,
          ),
        }
      : feed,
  );
}

function removeFromFeed(client: QueryClient, id: string) {
  client.setQueryData<InfiniteData<CursorPage<Post>>>(postKeys.feed(), feed =>
    feed
      ? {
          ...feed,
          pages: feed.pages.map(page => ({
            ...page,
            items: page.items.filter(post => post.id !== id),
          })),
        }
      : feed,
  );
}

const forgetPhoto = (photo: NewPhoto | null) =>
  photo
    ? services()
        .files.remove(photo.fileId)
        .catch(() => {})
    : Promise.resolve();

/**
 * A new post, with an optional photo: a queued write (offline pattern B, ADR 0006) that uploads the
 * photo first, then creates the post. The post shows at the top of the feed at once, with the
 * upload's progress; offline it waits ("Waiting to upload"), survives a restart, and goes out when the
 * phone reconnects. If the connection drops mid-upload it waits again instead of failing. If the
 * server refuses it, the post stays in the feed as failed, with Try again and Remove.
 *
 * Both requests reuse the write's idempotency key, so a retry never stores the photo or the post twice.
 */
export const useCreatePost = defineQueuedMutation<Post, CreatePostVariables>({
  mutationKey: createPostKey,
  // Network failures wait for the connection instead of failing; give up after many attempts.
  retry: (failureCount, error) => error.isTransient && failureCount < 20,
  mutationFn: async ({ postId, body, photo, idempotencyKey }) => {
    const signal = writeSignal(idempotencyKey);
    try {
      const imageUrl = photo
        ? (
            await uploadFile({
              url: '/uploads',
              schema: UploadSchema,
              fileId: photo.fileId,
              mimeType: photo.mimeType,
              fileName: photo.fileName,
              idempotencyKey: `${idempotencyKey}:photo`,
              progressKey: idempotencyKey,
              signal,
            })
          ).url
        : null;
      return await http.post('/posts', PostSchema, {
        body: { id: postId, body, image_url: imageUrl },
        idempotencyKey,
        signal,
      });
    } finally {
      releaseWriteSignal(idempotencyKey);
    }
  },
  onMutate: async variables => {
    await queryClient.cancelQueries({ queryKey: postKeys.feed() });
    const user = useSession.getState().user;
    const existing = findInFeed(queryClient, variables.postId);
    // A resend keeps the post where it is; a new post goes on top.
    if (existing?.local) {
      updatePost(queryClient, variables.postId, post => ({
        ...post,
        local: { state: 'sending', write: variables },
      }));
      return;
    }
    addToFeed(queryClient, {
      id: variables.postId,
      author: { id: user?.id ?? '', name: user?.name ?? '', avatarUrl: user?.avatarUrl ?? null },
      body: variables.body,
      imageUrl: null,
      likeCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      local: { state: 'sending', write: variables },
    });
  },
  onError: (error, variables) => {
    clearUploadProgress(variables.idempotencyKey);
    if (error.kind === 'cancelled') {
      // Removed by the person while it was sending.
      removeFromFeed(queryClient, variables.postId);
      forgetPhoto(variables.photo);
      return;
    }
    updatePost(queryClient, variables.postId, post => ({
      ...post,
      local: { state: 'failed', write: variables },
    }));
    toast.error(i18n.t('feed.postFailed'));
  },
  onSuccess: (created, variables) => {
    clearUploadProgress(variables.idempotencyKey);
    updatePost(queryClient, variables.postId, () => created);
    // The server has its own copy now. (The mock backend serves the photo from the kept file, so
    // it's kept in that case.)
    if (variables.photo && created.imageUrl !== services().files.uriOf(variables.photo.fileId)) {
      forgetPhoto(variables.photo);
    }
  },
});

/**
 * Removes a post that hasn't reached the server: stops its upload or takes it out of the queue,
 * then deletes it from the feed and its kept photo.
 */
export function discardLocalPost(post: Post): void {
  if (!post.local) return;
  discardQueuedWrite(post.local.write.idempotencyKey);
  clearUploadProgress(post.local.write.idempotencyKey);
  removeFromFeed(queryClient, post.id);
  forgetPhoto(post.local.write.photo);
}

/** Where a post that hasn't reached the server shows its photo from: the kept file on the phone. */
export function localPhotoUri(post: Post): string | null {
  const photo = post.local?.write.photo;
  return photo ? services().files.uriOf(photo.fileId) : null;
}

export type LocalPostStatus = 'uploading' | 'waiting' | 'failed';

/**
 * What each of this phone's unsent posts is doing, by post id. A post still marked "sending" whose
 * write isn't queued any more was cut off when the app closed: it shows as failed, with Try again.
 */
export function useLocalPostStatus(): (post: Post) => LocalPostStatus | null {
  const pending = usePendingWriteKeys(createPostKey);
  const waiting = new Set(
    useWaitingWrites<CreatePostVariables>(createPostKey).map(write => write.idempotencyKey),
  );
  return post => {
    if (!post.local) return null;
    const key = post.local.write.idempotencyKey;
    if (post.local.state === 'failed' || !pending.has(key)) return 'failed';
    return waiting.has(key) ? 'waiting' : 'uploading';
  };
}

/** Keeps a picked photo on the phone until its post is uploaded, resized for upload. */
export async function keepPhoto(photo: PickedPhoto): Promise<NewPhoto> {
  const fileId = await services().files.keep(photo.uri);
  return { fileId, mimeType: photo.mimeType, fileName: photo.fileName };
}

/** Picks or takes a photo for a post. Resolves null when the person cancels. */
export const pickPostPhoto = (source: PhotoSource) =>
  services().photos.pick(source, { maxSize: PHOTO_MAX_SIZE });
