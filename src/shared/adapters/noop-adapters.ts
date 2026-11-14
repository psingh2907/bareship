import type {
  Analytics,
  CrashReporter,
  FeatureFlags,
  Logger,
  SocialSignIn, // @social
  Updates,
} from '@/shared/ports';

/** Crash reporter that forwards to the logger until Crashlytics is configured (Phase 3). */
export function createLoggingCrashReporter(logger: Logger): CrashReporter {
  return {
    recordError: (error, context) =>
      logger.error(error instanceof Error ? error.message : String(error), {
        ...context,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    log: message => logger.debug(message),
    setUser: () => {},
  };
}

/** Analytics that logs events at debug level until a vendor is configured (Phase 3). */
export function createLoggingAnalytics(logger: Logger): Analytics {
  return {
    track: (event, properties) => logger.debug(`analytics: ${event}`, properties),
    screen: name => logger.debug(`analytics: screen ${name}`),
    identify: () => {},
  };
}

/** Flags that always return their fallback, optionally overridden by local defaults. */
export function createStaticFlags(
  defaults: Record<string, string | number | boolean> = {},
): FeatureFlags {
  const read = <T extends string | number | boolean>(key: string, fallback: T): T => {
    const value = defaults[key];
    return typeof value === typeof fallback ? (value as T) : fallback;
  };
  return {
    getBoolean: read,
    getString: read,
    getNumber: read,
    refresh: async () => {},
  };
}

// @social-start
/** No sign-in provider configured for this build: the buttons stay hidden (ADR 0020). */
export function createNoSocialSignIn(): SocialSignIn {
  return {
    providers: () => [],
    signIn: async () => null,
    signOut: async () => {},
  };
}
// @social-end

/** No OTA provider yet (ADR 0010). */
export function createNoopUpdates(): Updates {
  return {
    check: async () => 'unsupported',
    apply: async () => {},
  };
}
