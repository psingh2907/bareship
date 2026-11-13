import { Appearance, AppState } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { services } from '@/shared/services/services';

import { followSystemAppearance, setThemePreference } from './preference';

type Listener = (...args: never[]) => void;

function captureListeners() {
  const listeners: { appearance?: Listener; appState?: Listener } = {};
  jest.spyOn(Appearance, 'addChangeListener').mockImplementation(listener => {
    listeners.appearance = listener as Listener;
    return { remove: jest.fn() } as never;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.appState = listener as Listener;
    return { remove: jest.fn() } as never;
  });
  return listeners;
}

describe('followSystemAppearance', () => {
  afterEach(() => jest.restoreAllMocks());

  it('re-applies the adaptive theme when the OS appearance changes and the choice is "system"', () => {
    const listeners = captureListeners();
    const setAdaptive = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    followSystemAppearance();

    (listeners.appearance as () => void)();
    expect(setAdaptive).toHaveBeenCalledWith(true);
  });

  it('re-applies it when the app comes back to the foreground, not when it leaves', () => {
    const listeners = captureListeners();
    const setAdaptive = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    followSystemAppearance();

    (listeners.appState as (state: string) => void)('background');
    expect(setAdaptive).not.toHaveBeenCalled();
    (listeners.appState as (state: string) => void)('active');
    expect(setAdaptive).toHaveBeenCalledWith(true);
  });

  it('leaves an explicit light or dark choice alone', () => {
    const listeners = captureListeners();
    setThemePreference('dark');
    const setAdaptive = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    followSystemAppearance();

    (listeners.appearance as () => void)();
    expect(setAdaptive).not.toHaveBeenCalled();
    services().kv.remove('settings.theme');
  });
});
