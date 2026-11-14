/**
 * Ports: the only way app code touches native or vendor capabilities.
 * Track A (bare) and Track B (Expo) provide different adapters for the same ports, and
 * tests swap in fakes. See docs/decisions/0001 and docs/native-changes.md.
 */

/** Small, synchronous key-value storage for preferences and caches. Not for secrets. */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  getBoolean(key: string): boolean | undefined;
  getNumber(key: string): number | undefined;
  set(key: string, value: string | number | boolean): void;
  remove(key: string): void;
  clearAll(): void;
}

/** Encrypted storage backed by the iOS Keychain / Android Keystore. Use for tokens and secrets. */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/** Crash and error reporting (Crashlytics when Firebase is set up). */
export interface CrashReporter {
  recordError(error: unknown, context?: LogContext): void;
  log(message: string): void;
  setUser(userId: string | null): void;
}

/** Product analytics (Firebase Analytics when Firebase is set up). */
export interface Analytics {
  track(event: string, properties?: Record<string, string | number | boolean>): void;
  screen(name: string): void;
  identify(userId: string | null): void;
}

/** Feature flags and remote config (Firebase Remote Config when Firebase is set up). */
export interface FeatureFlags {
  getBoolean(key: string, fallback: boolean): boolean;
  getString(key: string, fallback: string): string;
  getNumber(key: string, fallback: number): number;
  /** Fetches and activates the latest values. Resolves even when offline. */
  refresh(): Promise<void>;
}

export type PushPermission = 'granted' | 'denied' | 'not-determined';

/** A notification as the app sees it. `data.link` is a deep link opened on tap (ADR 0010). */
export type PushMessage = { title?: string; body?: string; data: Record<string, string> };

/**
 * Notifications: local display everywhere; remote delivery (FCM) when Firebase is set up
 * (notify-kit + @react-native-firebase/messaging; expo-notifications in Track B).
 */
export interface Push {
  /** Current permission, without prompting. */
  permission(): Promise<PushPermission>;
  /** Shows the system prompt where the OS still allows it (iOS, Android 13+). */
  requestPermission(): Promise<PushPermission>;
  /** This device's push token for your backend. Null without Firebase or permission. */
  getToken(): Promise<string | null>;
  onTokenChange(listener: (token: string) => void): () => void;
  /** The notification whose tap launched the app, once per launch. */
  initialOpen(): Promise<PushMessage | null>;
  /** A tap on a notification while the app is running or in the background. */
  onOpen(listener: (message: PushMessage) => void): () => void;
  /** Shows a notification now (e.g. an incoming message while the app is in the foreground). */
  showLocal(message: PushMessage): Promise<void>;
}

/** The installed app's identity (react-native-device-info; expo-application in Track B). */
export interface AppInfo {
  /** Marketing version, e.g. "1.4.0" (Android dev and staging builds add "-dev" / "-staging"). */
  version(): string;
  /** Store build number, e.g. "42". */
  buildNumber(): string;
  /** Bundle id / application id, including the environment suffix. */
  bundleId(): string;
}

export type UpdateStatus = 'up-to-date' | 'update-ready' | 'unsupported';

/** Over-the-air JS updates. No provider is configured yet (ADR 0010); the adapter is a no-op. */
export interface Updates {
  check(): Promise<UpdateStatus>;
  /** Restarts into the downloaded update. Only call after check() returned 'update-ready'. */
  apply(): Promise<void>;
}

// @social-start
export type SocialProvider = 'apple' | 'google';

/** What a provider returns. The backend checks `idToken` against the provider's public keys. */
export type SocialCredential = {
  provider: SocialProvider;
  /** A JWT signed by Apple or Google. */
  idToken: string;
  /** Apple: the raw nonce; the token carries its SHA-256 hash. */
  nonce?: string;
  /** Apple: a one-time code the backend can trade for a refresh token (needed to revoke on deletion). */
  authorizationCode?: string;
  /** Apple sends the name only on the first sign-in, so pass it on to the backend then. */
  name?: string;
};

/**
 * Sign in with Apple and Google (react-native-google-signin and react-native-apple-authentication;
 * expo-apple-authentication in Track B). ADR 0020.
 */
export interface SocialSignIn {
  /** Providers configured for this build and supported on this device, in display order. */
  providers(): SocialProvider[];
  /** Shows the provider's sheet. Resolves null when the user cancels. */
  signIn(provider: SocialProvider): Promise<SocialCredential | null>;
  /** Forgets the provider's own session, so the account chooser shows next time. */
  signOut(): Promise<void>;
}
// @social-end
