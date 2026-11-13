import { AuthResponseSchema } from '@/entities/session/api';
import { NoContent } from '@/shared/api/client';
import { http } from '@/shared/api/http';
import type { SocialCredential } from '@/shared/ports';

import type { ForgotPasswordInput, LoginInput, RegisterInput } from './schema';

export function login(input: LoginInput) {
  return http.post('/auth/login', AuthResponseSchema, { body: input, auth: false });
}

export function register(input: RegisterInput) {
  return http.post('/auth/register', AuthResponseSchema, { body: input, auth: false });
}

export function requestPasswordReset(input: ForgotPasswordInput) {
  return http.post('/auth/forgot-password', NoContent, { body: input, auth: false });
}

/** Trades an Apple or Google ID token for a session. The backend verifies the token (ADR 0020). */
export function socialSignIn(credential: SocialCredential) {
  return http.post('/auth/social', AuthResponseSchema, { body: credential, auth: false });
}
