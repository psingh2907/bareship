import { appleAuth } from '@invertase/react-native-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { createConsoleLogger } from './console-logger';
import { configuredProviders, createNativeSocialSignIn } from './native-social-sign-in';

const logger = createConsoleLogger('error');
const FULL = { googleWebClientId: 'web', googleIosClientId: 'ios', appleEnabled: true };

describe('configuredProviders', () => {
  it('offers Apple first on iOS, then Google once both Google client ids are set', () => {
    expect(configuredProviders(FULL)).toEqual(['apple', 'google']);
    expect(configuredProviders({ ...FULL, googleIosClientId: '' })).toEqual(['apple']);
    expect(configuredProviders({ ...FULL, appleEnabled: false })).toEqual(['google']);
  });

  it('never offers Apple on Android, and Google needs only the web client id there', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(configuredProviders({ ...FULL, googleIosClientId: '' })).toEqual(['google']);
    expect(configuredProviders({ ...FULL, googleWebClientId: '' })).toEqual([]);
  });
});

describe('createNativeSocialSignIn', () => {
  it('configures Google with both client ids', () => {
    createNativeSocialSignIn(FULL, logger);
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web', iosClientId: 'ios' });
  });

  it('hides Apple on devices that do not support it', () => {
    jest.replaceProperty(appleAuth, 'isSupported', false);
    expect(createNativeSocialSignIn(FULL, logger).providers()).toEqual(['google']);
  });

  it("returns Apple's token, raw nonce, code and name", async () => {
    jest.mocked(appleAuth.performRequest).mockResolvedValueOnce({
      identityToken: 'apple-jwt',
      nonce: 'raw-nonce',
      authorizationCode: 'code',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    } as never);
    await expect(createNativeSocialSignIn(FULL, logger).signIn('apple')).resolves.toEqual({
      provider: 'apple',
      idToken: 'apple-jwt',
      nonce: 'raw-nonce',
      authorizationCode: 'code',
      name: 'Ada Lovelace',
    });
  });

  it('resolves null when the user cancels either sheet', async () => {
    const social = createNativeSocialSignIn(FULL, logger);
    jest.mocked(appleAuth.performRequest).mockRejectedValueOnce({ code: '1001' });
    await expect(social.signIn('apple')).resolves.toBeNull();
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null });
    await expect(social.signIn('google')).resolves.toBeNull();
    jest.mocked(GoogleSignin.signIn).mockRejectedValueOnce({ code: 'SIGN_IN_CANCELLED' });
    await expect(social.signIn('google')).resolves.toBeNull();
  });

  it("returns Google's ID token, and rejects a sign-in without one", async () => {
    const social = createNativeSocialSignIn(FULL, logger);
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'google-jwt', user: { name: 'Ada' } },
    } as never);
    await expect(social.signIn('google')).resolves.toEqual({
      provider: 'google',
      idToken: 'google-jwt',
      name: 'Ada',
    });
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: 'success',
      data: { idToken: null, user: { name: null } },
    } as never);
    await expect(social.signIn('google')).rejects.toThrow('Google returned no ID token');
  });

  it('checks Play services before Google sign-in on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null });
    await createNativeSocialSignIn(FULL, logger).signIn('google');
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
  });

  it('signs out of Google, and never throws doing it', async () => {
    const social = createNativeSocialSignIn(FULL, logger);
    jest.mocked(GoogleSignin.signOut).mockRejectedValueOnce(new Error('no session'));
    await expect(social.signOut()).resolves.toBeUndefined();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});
