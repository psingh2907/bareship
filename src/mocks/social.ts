import { Platform } from 'react-native';

import type { SocialProvider, SocialSignIn } from '@/shared/ports';

import { wait } from './helpers';

/** Email the mock providers sign in as: the seeded demo account, so the feed has the demo's data. */
export const MOCK_SOCIAL_EMAIL = 'demo@example.com';

/** A token the mock backend accepts in place of a real Apple or Google ID token. */
export const mockIdToken = (provider: SocialProvider, email = MOCK_SOCIAL_EMAIL) =>
  `mock.${provider}.${email}`;

/**
 * Stands in for Apple and Google while the mock backend runs (ADR 0020), so the buttons work with no
 * Google Cloud project or Apple team. Apple shows on iOS only, as it would for real.
 */
export function createMockSocialSignIn(): SocialSignIn {
  return {
    providers: () => (Platform.OS === 'ios' ? ['apple', 'google'] : ['google']),
    async signIn(provider) {
      await wait();
      return {
        provider,
        idToken: mockIdToken(provider),
        nonce: provider === 'apple' ? 'mock-nonce' : undefined,
      };
    },
    signOut: async () => {},
  };
}
