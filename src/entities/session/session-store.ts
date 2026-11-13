import { create } from 'zustand';

import { clearPersistedQueries } from '@/data/persister';
import { queryClient } from '@/data/query-client';
import { type User, UserSchema } from '@/entities/user/schema';
import { sessionTokens } from '@/shared/api/session-tokens';
import { type Tokens } from '@/shared/api/token-store';
import { services } from '@/shared/services/services';

import { fetchCurrentUser } from './api';

export type SessionStatus = 'unknown' | 'signedOut' | 'signedIn';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  /** Restores the session at launch: tokens from the Keychain, last user from MMKV. Never blocks on network. */
  hydrate: () => Promise<void>;
  signIn: (session: { tokens: Tokens; user: User }) => Promise<void>;
  /** Clears tokens, the user and every cached query. `reason` is logged, not shown. */
  signOut: (reason?: 'user' | 'expired' | 'deleted') => Promise<void>;
  /** Refreshes the user from the server in the background. */
  refreshUser: () => Promise<void>;
};

const USER_KEY = 'session.user';

function readCachedUser(): User | null {
  const raw = services().kv.getString(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = UserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (user) services().kv.set(USER_KEY, JSON.stringify(user));
  else services().kv.remove(USER_KEY);
}

/**
 * Session state machine: unknown → signedOut | signedIn. Navigation gates read `status`.
 * Tokens live only in the SecureStore (via sessionTokens); this store holds no secrets.
 */
export const useSession = create<SessionState>()((set, get) => ({
  status: 'unknown',
  user: null,

  async hydrate() {
    const tokens = await sessionTokens().get();
    const user = readCachedUser();
    if (tokens && user) {
      set({ status: 'signedIn', user });
      services().crash.setUser(user.id);
      get().refreshUser();
    } else {
      set({ status: 'signedOut', user: null });
    }
  },

  async signIn({ tokens, user }) {
    await sessionTokens().set(tokens);
    writeCachedUser(user);
    services().crash.setUser(user.id);
    services().analytics.identify(user.id);
    set({ status: 'signedIn', user });
  },

  async signOut(reason = 'user') {
    services().logger.info('Signing out', { reason });
    await sessionTokens().clear();
    // Forget the Google account too, so the next sign-in shows the account chooser.
    services()
      .social.signOut()
      .catch(() => {});
    writeCachedUser(null);
    queryClient.clear();
    clearPersistedQueries();
    services().crash.setUser(null);
    services().analytics.identify(null);
    set({ status: 'signedOut', user: null });
  },

  async refreshUser() {
    try {
      const user = await fetchCurrentUser();
      writeCachedUser(user);
      set({ user });
    } catch (error) {
      // Offline or server trouble: keep the cached user. A failed refresh signs out via the HTTP client.
      services().logger.debug('Could not refresh the current user', { error: String(error) });
    }
  },
}));

export const useIsSignedIn = () => useSession(state => state.status === 'signedIn');
export const useIsSignedOut = () => useSession(state => state.status === 'signedOut');
