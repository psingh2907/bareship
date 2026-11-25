import { Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';

import { createConsoleLogger, redact } from './console-logger';
import { createKeychainSecureStore } from './keychain-secure-store';
import { createMmkvKeyValueStore } from './mmkv-key-value-store';
import {
  createLoggingAnalytics,
  createLoggingCrashReporter,
  createNoopUpdates,
  createStaticFlags,
} from './noop-adapters';
import { createPermissions } from './permissions';

describe('createMmkvKeyValueStore', () => {
  it('stores strings, numbers and booleans, and removes them', () => {
    const kv = createMmkvKeyValueStore('adapter-test');
    kv.set('s', 'text');
    kv.set('n', 42);
    kv.set('b', true);
    expect([kv.getString('s'), kv.getNumber('n'), kv.getBoolean('b')]).toEqual(['text', 42, true]);
    kv.remove('s');
    expect(kv.getString('s')).toBeUndefined();
    kv.clearAll();
    expect(kv.getNumber('n')).toBeUndefined();
  });
});

describe('createKeychainSecureStore', () => {
  it('namespaces each key as its own Keychain service', async () => {
    const store = createKeychainSecureStore('app.dev');
    await store.set('token', 'secret');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'token',
      'secret',
      expect.objectContaining({
        service: 'app.dev.token',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
      }),
    );
    await expect(store.get('token')).resolves.toBe('secret');
    await store.remove('token');
    await expect(store.get('token')).resolves.toBeNull();
  });

  it('throws when the Keychain refuses to save', async () => {
    (Keychain.setGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    await expect(createKeychainSecureStore('app.dev').set('k', 'v')).rejects.toThrow(
      /could not save/,
    );
  });
});

describe('createConsoleLogger', () => {
  it('drops messages below the minimum level and redacts secrets', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createConsoleLogger('warn');
    logger.debug('hidden');
    logger.warn('shown', { accessToken: 'abc', userId: 'u1' });
    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[warn] shown', { accessToken: '[redacted]', userId: 'u1' });
    warn.mockRestore();
    log.mockRestore();
  });

  it('redact() masks token, password and authorization keys', () => {
    expect(redact({ password: 'x', Authorization: 'y', refresh_token: 'z', ok: 1 })).toEqual({
      password: '[redacted]',
      Authorization: '[redacted]',
      refresh_token: '[redacted]',
      ok: 1,
    });
  });
});

describe('no-op adapters', () => {
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  it('crash reporter and analytics forward to the logger', () => {
    createLoggingCrashReporter(logger).recordError(new Error('boom'), { screen: 'Feed' });
    expect(logger.error).toHaveBeenCalledWith('boom', expect.objectContaining({ screen: 'Feed' }));
    createLoggingAnalytics(logger).track('login', { method: 'email' });
    expect(logger.debug).toHaveBeenCalledWith('analytics: login', { method: 'email' });
  });

  it('static flags return defaults of the right type, else the fallback', async () => {
    const flags = createStaticFlags({ newFeed: true, title: 'Hi', limit: 3 });
    expect(flags.getBoolean('newFeed', false)).toBe(true);
    expect(flags.getString('title', 'x')).toBe('Hi');
    expect(flags.getNumber('limit', 10)).toBe(3);
    expect(flags.getBoolean('title', false)).toBe(false); // wrong type → fallback
    expect(flags.getString('missing', 'fallback')).toBe('fallback');
    await expect(flags.refresh()).resolves.toBeUndefined();
  });

  it('updates report "unsupported" until a provider is configured', async () => {
    await expect(createNoopUpdates().check()).resolves.toBe('unsupported');
  });
});

describe('createPermissions', () => {
  it('routes each kind to its handler and opens the system settings', async () => {
    const handler = {
      check: jest.fn(async () => 'not-determined' as const),
      request: jest.fn(async () => 'granted' as const),
    };
    const permissions = createPermissions({ notifications: handler, camera: handler });
    await expect(permissions.check('notifications')).resolves.toBe('not-determined');
    await expect(permissions.request('notifications')).resolves.toBe('granted');
    await permissions.openSettings();
    expect(Linking.openSettings).toHaveBeenCalled();
  });
});
