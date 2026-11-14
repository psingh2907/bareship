import { useMutation } from '@tanstack/react-query';

import { useSession } from '@/entities/session/session-store';
import { isApiError } from '@/shared/api/errors';
import type { SocialProvider } from '@/shared/ports'; // @social
import { services } from '@/shared/services/services';

import { login, register, requestPasswordReset, socialSignIn } from '../api'; // @social:auth-api-import

export function useLogin() {
  const signIn = useSession(state => state.signIn);
  return useMutation({
    mutationFn: login,
    onSuccess: async session => {
      await signIn(session);
      services().analytics.track('login');
    },
  });
}

export function useRegister() {
  const signIn = useSession(state => state.signIn);
  return useMutation({
    mutationFn: register,
    onSuccess: async session => {
      await signIn(session);
      services().analytics.track('sign_up');
    },
  });
}

// @social-start
/**
 * Sign in with Apple or Google: the provider's sheet, then the backend. New accounts are created on
 * the first sign-in, so this serves both the sign-in and register screens. Resolves null on cancel.
 */
export function useSocialSignIn() {
  const signIn = useSession(state => state.signIn);
  return useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const credential = await services().social.signIn(provider);
      if (!credential) return null;
      return socialSignIn(credential);
    },
    onSuccess: async (session, provider) => {
      if (!session) return;
      await signIn(session);
      services().analytics.track('login', { method: provider });
    },
    onError: (error, provider) => {
      // Server errors are expected; a provider failing (bad client id, missing SHA-1) is a setup bug.
      if (!isApiError(error)) services().crash.recordError(error, { phase: 'social', provider });
    },
  });
}
// @social-end

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset });
}

/** True when the server rejected the request with this error code (e.g. "invalid_credentials"). */
export function hasErrorCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.details.code === code;
}
