import { http, HttpResponse } from 'msw';

import { ACCESS_TOKEN_TTL_MS, db, type PostRecord, type UserRecord } from './db'; // @example:mock-db-import
import { authenticate, error, mockFilePart, readToken, wait } from './helpers';

/**
 * Tokens are self-describing ("<kind>.<userId>.<expiresAt>.<nonce>") instead of rows in the mock db,
 * which resets on every JS reload. So a saved session keeps working across reloads, as it would
 * against a real backend. Only seeded users survive a reload; registered ones live in memory.
 */
function issueTokens(userId: string) {
  const nonce = Math.random().toString(36).slice(2, 10);
  return {
    accessToken: `access.${userId}.${Date.now() + ACCESS_TOKEN_TTL_MS}.${nonce}`,
    refreshToken: `refresh.${userId}.0.${nonce}`,
  };
}

const userDto = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatar_url,
});

// @example-start
function postDto(post: PostRecord, viewerId: string) {
  const author = db.current.users.find(user => user.id === post.author_id);
  const likedBy = db.current.likes.get(post.id) ?? new Set<string>();
  return {
    id: post.id,
    author: {
      id: post.author_id,
      display_name: author?.name ?? 'Unknown',
      avatar_url: author?.avatar_url ?? null,
    },
    body: post.body,
    image_url: post.image_url,
    like_count: post.like_count + likedBy.size,
    liked_by_me: likedBy.has(viewerId),
    created_at: post.created_at,
  };
}
// @example-end

type Credentials = { email?: string; password?: string; name?: string };
type SocialBody = { provider?: string; idToken?: string; nonce?: string; name?: string }; // @social

export const handlers = [
  http.post('*/auth/login', async ({ request }) => {
    await wait();
    const { email, password } = (await request.json()) as Credentials;
    const user = db.current.users.find(candidate => candidate.email === email?.toLowerCase());
    if (!user || user.password !== password) {
      return error(401, 'invalid_credentials', 'Email or password is incorrect.');
    }
    return HttpResponse.json({ tokens: issueTokens(user.id), user: userDto(user) });
  }),

  http.post('*/auth/register', async ({ request }) => {
    await wait();
    const { email = '', password = '', name = '' } = (await request.json()) as Credentials;
    if (db.current.users.some(user => user.email === email.toLowerCase())) {
      return error(409, 'email_taken', 'An account with this email already exists.');
    }
    const user: UserRecord = {
      id: `u_${db.current.users.length + 1}`,
      email: email.toLowerCase(),
      name,
      password,
      avatar_url: null,
    };
    db.current.users.push(user);
    return HttpResponse.json(
      { tokens: issueTokens(user.id), user: userDto(user) },
      { status: 201 },
    );
  }),

  // @social-start
  // Sign in with Apple or Google (ADR 0020). A real backend checks the ID token's signature, issuer,
  // audience, expiry and (Apple) nonce; this one accepts the mock provider's "mock.<provider>.<email>".
  http.post('*/auth/social', async ({ request }) => {
    await wait();
    const { provider, idToken = '', name } = (await request.json()) as SocialBody;
    const [kind, tokenProvider, email] = idToken.split(/\.(.+?)\.(.+)/);
    if (kind !== 'mock' || tokenProvider !== provider || !email) {
      return error(401, 'invalid_token', 'The sign-in could not be verified.');
    }
    let user = db.current.users.find(candidate => candidate.email === email.toLowerCase());
    const created = !user;
    if (!user) {
      user = {
        id: `u_${db.current.users.length + 1}`,
        email: email.toLowerCase(),
        name: name ?? email.split('@')[0]!,
        password: '',
        avatar_url: null,
      };
      db.current.users.push(user);
    }
    return HttpResponse.json(
      { tokens: issueTokens(user.id), user: userDto(user) },
      { status: created ? 201 : 200 },
    );
  }),
  // @social-end

  http.post('*/auth/refresh', async ({ request }) => {
    await wait();
    const { refreshToken } = (await request.json()) as { refreshToken?: string };
    const userId = refreshToken ? readToken(refreshToken, 'refresh')?.userId : undefined;
    if (!userId || !db.current.users.some(user => user.id === userId)) {
      return error(401, 'invalid_refresh_token', 'Sign in again.');
    }
    db.current.revokedTokens.add(refreshToken!); // rotate: each refresh token works once
    return HttpResponse.json(issueTokens(userId));
  }),

  http.post('*/auth/forgot-password', async () => {
    await wait();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/auth/logout', async ({ request }) => {
    await wait();
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token) db.current.revokedTokens.add(token);
    return new HttpResponse(null, { status: 204 });
  }),

  // Push token registration (src/app/push-registration.ts).
  http.post('*/devices', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    return user instanceof Response ? user : new HttpResponse(null, { status: 204 });
  }),

  http.get('*/me', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    return user instanceof Response ? user : HttpResponse.json(userDto(user));
  }),

  http.delete('*/me', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    db.current.users = db.current.users.filter(candidate => candidate.id !== user.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // A file upload (src/data/uploads.ts). Kept by `pnpm strip-examples`: apps keep the upload building
  // blocks. A photo upload. The in-app mock (native.ts) sends the multipart parts as JSON, and the "stored"
  // photo is served from the kept file on the phone; tests send real multipart data.
  http.post('*/uploads', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const key = request.headers.get('Idempotency-Key');
    const replay = key ? db.current.idempotency.get(key) : undefined;
    if (replay) return HttpResponse.json(replay, { status: 201 });
    const id = `upload_${db.current.idempotency.size + 1}`;
    const part = await mockFilePart(request);
    const body = { id, url: part?.uri ?? `https://example.com/uploads/${id}.jpg` };
    if (key) db.current.idempotency.set(key, body);
    return HttpResponse.json(body, { status: 201 });
  }),

  // @example-start
  http.get('*/posts', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('cursor') ?? '0') || 0;
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '10') || 10, 50);
    const slice = db.current.posts.slice(offset, offset + limit);
    const next = offset + limit < db.current.posts.length ? String(offset + limit) : null;
    return HttpResponse.json({
      items: slice.map(post => postDto(post, user.id)),
      nextCursor: next,
    });
  }),

  http.get('*/posts/:id', async ({ request, params }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const post = db.current.posts.find(candidate => candidate.id === params.id);
    return post
      ? HttpResponse.json(postDto(post, user.id))
      : error(404, 'not_found', 'Post not found.');
  }),

  ...(['post', 'delete'] as const).map(method =>
    http[method]('*/posts/:id/like', async ({ request, params }) => {
      await wait();
      const user = authenticate(request);
      if (user instanceof Response) return user;
      const key = request.headers.get('Idempotency-Key');
      const replay = key ? db.current.idempotency.get(key) : undefined;
      if (replay) return HttpResponse.json(replay);
      const post = db.current.posts.find(candidate => candidate.id === params.id);
      if (!post) return error(404, 'not_found', 'Post not found.');
      const likedBy = db.current.likes.get(post.id) ?? new Set<string>();
      if (method === 'post') likedBy.add(user.id);
      else likedBy.delete(user.id);
      db.current.likes.set(post.id, likedBy);
      // Writes return the updated resource, so the client never needs a follow-up GET.
      const body = postDto(post, user.id);
      if (key) db.current.idempotency.set(key, body);
      return HttpResponse.json(body);
    }),
  ),

  // A new post. The client picks the id, so a replay after a lost response doesn't create a twin.
  // A post containing "#fail" is refused, to show (and test) the failed state.
  http.post('*/posts', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const key = request.headers.get('Idempotency-Key');
    const replay = key ? db.current.idempotency.get(key) : undefined;
    if (replay) return HttpResponse.json(replay, { status: 201 });
    const input = (await request.json()) as {
      id?: string;
      body?: string;
      image_url?: string | null;
    };
    const text = (input.body ?? '').trim();
    if (!text && !input.image_url)
      return error(422, 'empty_post', 'Write something or add a photo.');
    if (text.includes('#fail')) return error(422, 'rejected', 'The server refused this post.');
    const existing = db.current.posts.find(post => post.id === input.id);
    const post: PostRecord = existing ?? {
      id: input.id ?? `p_new_${db.current.posts.length + 1}`,
      author_id: user.id,
      body: text,
      image_url: input.image_url ?? null,
      like_count: 0,
      created_at: new Date().toISOString(),
    };
    if (!existing) db.current.posts.unshift(post);
    const body = postDto(post, user.id);
    if (key) db.current.idempotency.set(key, body);
    return HttpResponse.json(body, { status: 201 });
  }),
  // @example-end
  // gen:handlers (`pnpm gen` adds feature handlers above this line)
];
