import { Appearance, AppState } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { services } from '@/shared/services/services';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'settings.theme';

export function getThemePreference(): ThemePreference {
  const value = services().kv.getString(KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Saves the choice and applies it immediately, without re-rendering the tree (Unistyles 3). */
export function setThemePreference(preference: ThemePreference): void {
  services().kv.set(KEY, preference);
  if (preference === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true);
  } else {
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(preference);
  }
}

/**
 * Keeps the "system" theme in step with the OS while the app runs. Call once at startup; returns a
 * cleanup function.
 *
 * Unistyles 3.5 follows the OS on its own (adaptive themes), but it sometimes misses a switch, most
 * often the first one after launch: its native listener compares a cached snapshot and the theme
 * stays as it was until the next switch or a restart. React Native's own Appearance event does arrive
 * every time, and by then `UnistylesRuntime.colorScheme` already has the new value, so on that event
 * (and when the app returns to the foreground, where iOS skips the event) this asks Unistyles to
 * re-apply its adaptive theme. `setAdaptiveThemes(true)` with adaptive themes already on only changes
 * the theme when it no longer matches the OS, so a call that isn't needed does nothing.
 */
export function followSystemAppearance(): () => void {
  const resync = () => {
    if (getThemePreference() === 'system') UnistylesRuntime.setAdaptiveThemes(true);
  };
  const appearance = Appearance.addChangeListener(resync);
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') resync();
  });
  return () => {
    appearance.remove();
    appState.remove();
  };
}
