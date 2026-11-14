import Config from 'react-native-config';
import { z } from 'zod';

/**
 * The only module that reads build-time configuration.
 * Values come from .env.<environment> via react-native-config and are public:
 * never put secrets in them. See docs/decisions/0004-environments-and-config.md.
 */
const EnvSchema = z.object({
  APP_ENV: z.enum(['dev', 'staging', 'prod']),
  API_URL: z.url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Serve API calls from the in-app mock server (src/mocks). Only honoured in __DEV__ builds. */
  API_MOCKS: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  /** URL scheme for deep links, e.g. myapp-dev://post/1. Native projects read the same value. */
  APP_SCHEME: z.string().regex(/^[a-z][a-z0-9+.-]*$/, 'lowercase letters, digits, + . - only'),
  /** Web domain for universal links / App Links (https://<domain>/post/1). Empty: links off. */
  APP_LINK_DOMAIN: z
    .string()
    .regex(
      /^$|^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/,
      'a bare domain, e.g. links.example.com',
    )
    .default(''),
  // @social-start
  /** Google sign-in (ADR 0020): the "Web application" OAuth client id. Empty: no Google button. */
  GOOGLE_WEB_CLIENT_ID: z.string().default(''),
  /** The "iOS" OAuth client id. iOS shows the Google button only when this is set too. */
  GOOGLE_IOS_CLIENT_ID: z.string().default(''),
  /** Sign in with Apple capability (needs an Apple team). Native projects read the same value. */
  IOS_APPLE_SIGN_IN: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  /**
   * With the mock backend (API_MOCKS), show Apple and Google buttons that sign in as the demo user. Set it
   * to false to try the app without them; real builds never use the mock providers.
   */
  SOCIAL_SIGN_IN_MOCKS: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  // @social-end
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map(issue => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid app configuration. Check .env.<environment> for these keys:\n${problems}`,
    );
  }
  return result.data;
}

export const env: Env = parseEnv(Config);

export const isProd = env.APP_ENV === 'prod';

export { parseEnv };
