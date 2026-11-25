import { z } from 'zod';

import { cursorPageSchema } from '@/shared/api/pagination';

/** What the server sends (snake_case). Never leaves this feature's api/ layer. */
export const PostDtoSchema = z.object({
  id: z.string(),
  author: z.object({ id: z.string(), display_name: z.string(), avatar_url: z.url().nullable() }),
  body: z.string(),
  image_url: z.url().nullable(),
  like_count: z.number().int().nonnegative(),
  liked_by_me: z.boolean(),
  created_at: z.iso.datetime(),
});

/** What the app uses. */
export type Post = {
  id: string;
  author: { id: string; name: string; avatarUrl: string | null };
  body: string;
  imageUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  /** Set only on a post made on this phone that the server doesn't have yet (see `useCreatePost`). */
  local?: LocalPost;
};

/** A photo picked for a new post, kept on the phone until it's uploaded. */
export type NewPhoto = { fileId: string; mimeType: string; fileName: string };

export type CreatePostVariables = { postId: string; body: string; photo: NewPhoto | null };

export type LocalPost = {
  /** `failed`: the server refused it, or it was still sending when the app was closed. */
  state: 'sending' | 'failed';
  /** The write's idempotency key and variables, to show its progress and send it again. */
  write: CreatePostVariables & { idempotencyKey: string; accountId?: string | null };
};

export const PostSchema = PostDtoSchema.transform((dto): Post => ({
  id: dto.id,
  author: { id: dto.author.id, name: dto.author.display_name, avatarUrl: dto.author.avatar_url },
  body: dto.body,
  imageUrl: dto.image_url,
  likeCount: dto.like_count,
  likedByMe: dto.liked_by_me,
  createdAt: dto.created_at,
}));

export const FeedPageSchema = cursorPageSchema(PostSchema);

/** POST /uploads: where the server stored the file. */
export const UploadSchema = z.object({ id: z.string(), url: z.url() });
