import { createConsoleLogger } from '@/shared/adapters/console-logger';
import { createDeviceAppInfo } from '@/shared/adapters/device-info-app-info';
import { createFileAccessFileStore } from '@/shared/adapters/file-access-file-store';
import { isFirebaseConfigured } from '@/shared/adapters/firebase-app';
import { createImagePickerPhotoPicker } from '@/shared/adapters/image-picker-photo-picker';
import { createKeychainSecureStore } from '@/shared/adapters/keychain-secure-store';
import { createMmkvKeyValueStore } from '@/shared/adapters/mmkv-key-value-store';
import { cameraPermission } from '@/shared/adapters/native-permissions';
import {
  createLoggingAnalytics,
  createLoggingCrashReporter,
  createNoopUpdates,
  createNoSocialSignIn, // @social
  createStaticFlags,
} from '@/shared/adapters/noop-adapters';
import { createNotifyKitPush } from '@/shared/adapters/notify-kit-push';
import { createPermissions } from '@/shared/adapters/permissions';
import { env } from '@/shared/config/env';
import { FLAG_DEFAULTS } from '@/shared/config/flags';
import type {
  Analytics,
  AppInfo,
  CrashReporter,
  FeatureFlags,
  FileStore,
  KeyValueStore,
  Logger,
  Permissions,
  PhotoPicker,
  Push,
  SecureStore,
  SocialSignIn, // @social
  Updates,
} from '@/shared/ports';

/**
 * Service registry: one place that picks an adapter for every port.
 * App code calls `services()`; tests call `setServices()` with fakes.
 * When the native app started Firebase (ADR 0010), crash, analytics and flags use Firebase; otherwise
 * they log and return defaults, so the template runs before any Firebase project exists.
 */
export type Services = {
  kv: KeyValueStore;
  secure: SecureStore;
  logger: Logger;
  crash: CrashReporter;
  analytics: Analytics;
  flags: FeatureFlags;
  updates: Updates;
  appInfo: AppInfo;
  push: Push;
  permissions: Permissions;
  photos: PhotoPicker;
  files: FileStore;
  social: SocialSignIn; // @social
};

function createDefaultServices(): Services {
  const logger = createConsoleLogger(env.LOG_LEVEL);
  return {
    kv: createMmkvKeyValueStore(),
    secure: createKeychainSecureStore(`app.${env.APP_ENV}`),
    logger,
    ...createVendorServices(logger),
    updates: createNoopUpdates(),
    appInfo: createDeviceAppInfo(),
    // Read through services() so a push adapter swapped in later (tests, boot) is the one asked.
    permissions: createPermissions({
      notifications: {
        check: () => services().push.permission(),
        request: () => services().push.requestPermission(),
      },
      camera: cameraPermission(),
    }),
    photos: createImagePickerPhotoPicker(logger),
    files: createFileAccessFileStore(),
    social: createSocialSignIn(logger), // @social
  };
}

// @social-start
/** Apple and Google when their ids are in .env (ADR 0020); nothing otherwise, so no buttons show. */
function createSocialSignIn(logger: Logger): SocialSignIn {
  const configured =
    env.IOS_APPLE_SIGN_IN || env.GOOGLE_WEB_CLIENT_ID !== '' || env.GOOGLE_IOS_CLIENT_ID !== '';
  if (!configured) return createNoSocialSignIn();
  // Loaded lazily, like Firebase: builds without sign-in never load the two native modules.
  const { createNativeSocialSignIn } =
    require('@/shared/adapters/native-social-sign-in') as typeof import('@/shared/adapters/native-social-sign-in');
  return createNativeSocialSignIn(
    {
      googleWebClientId: env.GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: env.GOOGLE_IOS_CLIENT_ID,
      appleEnabled: env.IOS_APPLE_SIGN_IN,
    },
    logger,
  );
}
// @social-end

/** Firebase when it's set up for this build; logging and static defaults otherwise. */
function createVendorServices(
  logger: Logger,
): Pick<Services, 'crash' | 'analytics' | 'flags' | 'push'> {
  if (isFirebaseConfigured()) {
    // Loaded lazily: builds without Firebase never evaluate the Crashlytics, Analytics or Remote
    // Config modules.
    const firebase =
      require('@/shared/adapters/firebase') as typeof import('@/shared/adapters/firebase');
    return {
      crash: firebase.createFirebaseCrashReporter(logger),
      analytics: firebase.createFirebaseAnalytics(),
      flags: firebase.createRemoteConfigFlags(FLAG_DEFAULTS, logger),
      push: (
        require('@/shared/adapters/firebase-push') as typeof import('@/shared/adapters/firebase-push')
      ).createFirebasePush(logger),
    };
  }
  logger.info('Firebase is not set up for this build: crash, analytics and flags only log.');
  return {
    crash: createLoggingCrashReporter(logger),
    analytics: createLoggingAnalytics(logger),
    flags: createStaticFlags(FLAG_DEFAULTS),
    push: createNotifyKitPush(logger),
  };
}

let current: Services | undefined;

export function services(): Services {
  current ??= createDefaultServices();
  return current;
}

/** Replace some or all services. For tests and for wiring vendor adapters at boot. */
export function setServices(overrides: Partial<Services>): void {
  current = { ...services(), ...overrides };
}

/** Test helper: forget the registry so the next services() call builds fresh adapters. */
export function resetServices(): void {
  current = undefined;
}
