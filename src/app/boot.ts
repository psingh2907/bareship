import type { AxiosAdapter } from 'axios';
import { AppState } from 'react-native';

import { setQueueAccount } from '@/data/offline';
import { useAppStatus } from '@/entities/app-status/app-status-store';
import { refreshTokens } from '@/entities/session/api';
import { useSession } from '@/entities/session/session-store';
import { configureHttp } from '@/shared/api/http';
import { sessionTokens } from '@/shared/api/session-tokens';
import { env } from '@/shared/config/env';
import { currentLanguage, initI18n } from '@/shared/i18n';
import { setupQueryLifecycle } from '@/shared/lifecycle/query-lifecycle';
import { services } from '@/shared/services/services';

import { providedMockAdapter } from './mock-backend';
import { setupPushRegistration } from './push-registration';

let booted: Promise<void> | undefined;

/**
 * Everything that must happen before the first screen, in order. Runs once.
 * Keep it fast and offline-safe: it never waits on the network.
 */
export function boot(): Promise<void> {
  booted ??= (async () => {
    const { logger } = services();

    // First, so any screen (including the error screen) can render translated text.
    initI18n();

    // Demo release builds bring their own mock adapter (index.demo.js); dev environment only.
    let adapter: AxiosAdapter | undefined =
      env.APP_ENV === 'dev' && env.API_MOCKS ? providedMockAdapter() : undefined;
    // `__DEV__` must come first: it's a build-time constant, so release builds drop this branch and the
    // mock code with it (scripts/ci/check-no-mocks-in-release.sh guards this).
    if (__DEV__ && env.API_MOCKS && !adapter) {
      // Development-only mock backend (src/mocks). Required lazily so release code paths never run it.
      try {
        const { startMocks } = require('@/mocks/native') as typeof import('@/mocks/native');
        adapter = startMocks();
      } catch (error) {
        logger.error('Mock backend failed to start; requests will go to API_URL', {
          error: String(error),
        });
      }
    }

    configureHttp({
      baseURL: env.API_URL,
      tokens: sessionTokens(),
      logger,
      refreshTokens,
      onSessionExpired: () => {
        useSession.getState().signOut('expired');
      },
      getLanguage: currentLanguage,
      adapter,
    });

    setupQueryLifecycle();
    // Queued writes run only for the account that made them (ADR 0006).
    setQueueAccount(() => useSession.getState().user?.id ?? null);
    // Before the first screen: flags activated on the last launch can already block this version.
    useAppStatus.getState().evaluate();
    await useSession.getState().hydrate();
  })().catch(error => {
    // Never leave the app on the splash: a failed boot still decides the session (signed out).
    services().crash.recordError(error, { phase: 'boot' });
    if (useSession.getState().status === 'unknown')
      useSession.setState({ status: 'signedOut', user: null });
  });
  return booted;
}

/** Background work after the first screen is ready. */
export function afterBoot(): void {
  const { logger } = services();
  const refreshStatus = () =>
    useAppStatus
      .getState()
      .refresh()
      .catch(error => logger.warn('Feature flags refresh failed', { error: String(error) }));
  refreshStatus();
  setupPushRegistration();
  // Re-check on return to the foreground, so a forced update or maintenance reaches running apps.
  AppState.addEventListener('change', state => {
    if (state === 'active') refreshStatus();
  });
}
