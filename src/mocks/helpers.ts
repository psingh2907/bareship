import { delay, HttpResponse } from 'msw';

import { db, type UserRecord } from './db';

/** Simulated network latency (0 in tests via MOCK_LATENCY). */
const latency = { ms: 350 };
export function setMockLatency(ms: number) {
  latency.ms = ms;
}
export const wait = () => (latency.ms > 0 ? delay(latency.ms) : Promise.resolve());

/** Reads a token issued by the auth handlers ("<kind>.<userId>.<expiresAt>.<nonce>", see handlers.ts). */
export function readToken(token: string, kind: 'access' | 'refresh') {
  const [prefix, userId, expiresAt] = token.split('.');
  if (prefix !== kind || !userId || db.current.revokedTokens.has(token)) return undefined;
  return { userId, expiresAt: Number(expiresAt) };
}

export const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** Resolves the bearer token to a user, or returns the 401 response to send. */
export function authenticate(request: Request): UserRecord | Response {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  const session = readToken(token, 'access');
  if (!session) return error(401, 'unauthenticated', 'Sign in to continue.');
  if (session.expiresAt < Date.now()) return error(401, 'token_expired', 'Access token expired.');
  const user = db.current.users.find(candidate => candidate.id === session.userId);
  return user ?? error(401, 'unauthenticated', 'Sign in to continue.');
}

/** A file part as React Native's FormData describes it. */
export type MockFilePart = { fieldName: string; uri: string; name?: string; type?: string };

/**
 * The file in an upload request. In the app, the mock adapter (native.ts) sends React Native's
 * FormData parts as JSON (`{ parts }`); real multipart bodies (tests) have no readable file URI.
 */
export async function mockFilePart(request: Request): Promise<MockFilePart | null> {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  const { parts } = (await request.json()) as { parts?: MockFilePart[] };
  return parts?.find(part => typeof part.uri === 'string') ?? null;
}
