import {
  appleAuth,
  type AppleRequestOperation,
  type AppleRequestScope,
} from '@invertase/react-native-apple-authentication';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import type { Logger, SocialCredential, SocialProvider, SocialSignIn } from '@/shared/ports';

export type SocialSignInConfig = {
  /** OAuth client of type "Web application" in Google Cloud: the audience of Google's ID tokens. */
  googleWebClientId: string;
  /** OAuth client of type "iOS". Android needs none in code, only its SHA-1 in Google Cloud. */
  googleIosClientId: string;
  /** Sign in with Apple capability is on for this build (iOS only). */
  appleEnabled: boolean;
};

// The library's typings declare AppleError, AppleRequestOperation and AppleRequestScope as exports, but
// in 2.5.1 they exist at runtime only as properties of `appleAuth`, which the typings leave out. Using
// the declared enums crashes, so these copy the values from lib/AppleAuthModule.js.
const APPLE_LOGIN = 1 as AppleRequestOperation;
const APPLE_EMAIL = 0 as AppleRequestScope;
const APPLE_FULL_NAME = 1 as AppleRequestScope;
const APPLE_CANCELED = '1001';

/** Which providers this build can offer on this platform, before asking the device. */
export function configuredProviders(config: SocialSignInConfig): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (Platform.OS === 'ios' && config.appleEnabled) providers.push('apple');
  const googleReady =
    config.googleWebClientId !== '' && (Platform.OS !== 'ios' || config.googleIosClientId !== '');
  if (googleReady) providers.push('google');
  return providers;
}

/**
 * Sign in with Apple (iOS only, ADR 0020) and Google. Each returns an ID token for the backend to
 * check; the app never trusts the token itself.
 */
export function createNativeSocialSignIn(config: SocialSignInConfig, logger: Logger): SocialSignIn {
  const configured = configuredProviders(config);
  if (configured.includes('google')) {
    GoogleSignin.configure({
      webClientId: config.googleWebClientId,
      iosClientId: config.googleIosClientId || undefined,
    });
  }

  async function signInWithApple(): Promise<SocialCredential | null> {
    try {
      // The native module makes a random nonce, sends Apple its SHA-256 and returns the raw value.
      const response = await appleAuth.performRequest({
        requestedOperation: APPLE_LOGIN,
        requestedScopes: [APPLE_FULL_NAME, APPLE_EMAIL],
      });
      if (!response.identityToken) throw new Error('Apple returned no identity token');
      const name = [response.fullName?.givenName, response.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      return {
        provider: 'apple',
        idToken: response.identityToken,
        nonce: response.nonce,
        authorizationCode: response.authorizationCode ?? undefined,
        name: name || undefined,
      };
    } catch (error) {
      if ((error as { code?: string }).code === APPLE_CANCELED) return null;
      throw error;
    }
  }

  async function signInWithGoogle(): Promise<SocialCredential | null> {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) return null;
      if (!response.data.idToken) throw new Error('Google returned no ID token');
      return {
        provider: 'google',
        idToken: response.data.idToken,
        name: response.data.user.name ?? undefined,
      };
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      throw error;
    }
  }

  return {
    providers: () => configured.filter(provider => provider !== 'apple' || appleAuth.isSupported),
    signIn: provider => (provider === 'apple' ? signInWithApple() : signInWithGoogle()),
    async signOut() {
      // Apple keeps no session in the app. Google remembers the account until told otherwise.
      if (!configured.includes('google')) return;
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        logger.debug('Google sign-out failed', { error: String(error) });
      }
    },
  };
}
