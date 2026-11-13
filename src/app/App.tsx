import './queued-writes'; // before the saved cache is restored; see the file

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { resumeQueuedWrites } from '@/data/offline';
import { createPersistOptions } from '@/data/persister';
import { queryClient } from '@/data/query-client';
import { useAppStatus } from '@/entities/app-status/app-status-store';
import { useSession } from '@/entities/session/session-store';
import { MaintenanceScreen, UpdateRequiredScreen } from '@/features/app-status';
import { services } from '@/shared/services/services';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { followSystemAppearance } from '@/shared/ui/theme/preference';
import { ToastHost } from '@/shared/ui/toast/ToastHost';

import { afterBoot, boot } from './boot';
import { linking } from './navigation/linking';
import { Navigation } from './navigation/RootNavigator';
import { navigationTheme } from './navigation/theme';

const persistOptions = createPersistOptions();

export function App() {
  const { theme } = useUnistyles();
  const [booted, setBooted] = useState(false);
  const [restored, setRestored] = useState(false);
  const status = useSession(state => state.status);
  const appStatus = useAppStatus(state => state.status);

  // The "system" theme follows the OS while the app runs (see followSystemAppearance).
  useEffect(followSystemAppearance, []);

  useEffect(() => {
    boot().finally(() => {
      setBooted(true);
      afterBoot();
    });
  }, []);

  // Keep the native splash until the session and the cached data are back, so the first frame is real.
  const ready = booted && restored && status !== 'unknown';
  useEffect(() => {
    if (ready) BootSplash.hide({ fade: true }).catch(() => {});
  }, [ready]);

  // Replay writes queued before the app was closed. Wait for boot: the HTTP client and the session
  // must be ready, or the replay fails and rolls back. Then revalidate what the writes touched.
  // Offline, they stay queued and run when the connection returns.
  const resumed = useRef(false);
  useEffect(() => {
    if (!ready || resumed.current) return;
    resumed.current = true;
    if (status === 'signedIn') {
      resumeQueuedWrites().then(() => queryClient.invalidateQueries());
    } else {
      // The writes belong to a session that has ended (it expired while the app was closed).
      queryClient.getMutationCache().clear();
    }
  }, [ready, status]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => setRestored(true)}
          onError={() => setRestored(true)}
        >
          <BottomSheetModalProvider>
            <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
            <ErrorBoundary>
              {/* Remote Config can block this version (update) or the whole app (maintenance). */}
              {booted && appStatus === 'update-required' ? <UpdateRequiredScreen /> : null}
              {booted && appStatus === 'maintenance' ? <MaintenanceScreen /> : null}
              {booted && appStatus === 'ok' ? (
                <Navigation
                  theme={navigationTheme(theme)}
                  linking={linking}
                  onStateChange={state => {
                    const route = state?.routes[state.index];
                    if (route) services().analytics.screen(route.name);
                  }}
                />
              ) : null}
            </ErrorBoundary>
            <ToastHost />
          </BottomSheetModalProvider>
        </PersistQueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
}));
