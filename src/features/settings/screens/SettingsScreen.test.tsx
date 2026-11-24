import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { useSession } from '@/entities/session/session-store';
import type { Push, PushPermission } from '@/shared/ports';
import { services, setServices } from '@/shared/services/services';
import { signInDemoUser } from '@/test/app';
import { renderWithProviders } from '@/test/render';

import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(async () => {
    await signInDemoUser();
  });

  it('shows the signed-in user and saves the theme choice', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SettingsScreen />);
    expect(screen.getByText('demo@example.com')).toBeOnTheScreen();

    await user.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(services().kv.getString('settings.theme')).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeSelected();
  });

  it('explains notifications before the system prompt, and the row announces the result', async () => {
    let permission: PushPermission = 'not-determined';
    const push = {
      ...services().push,
      permission: async () => permission,
      requestPermission: jest.fn(async () => {
        permission = 'granted';
        return permission;
      }),
    } satisfies Push;
    setServices({ push });
    const user = userEvent.setup();
    await renderWithProviders(<SettingsScreen />);

    const row = await screen.findByRole('button', { name: 'Notifications' });
    expect(row).toHaveAccessibilityValue({ text: 'Off' });
    await user.press(row);
    expect(push.requestPermission).not.toHaveBeenCalled();

    // The test bottom sheet renders every sheet's content; the permission sheet comes first.
    await user.press(screen.getAllByRole('button', { name: 'Continue' })[0]!);
    expect(push.requestPermission).toHaveBeenCalled();
    expect(await screen.findByText('On')).toBeOnTheScreen();
  });

  it('shows blocked notifications and how to turn them back on', async () => {
    setServices({ push: { ...services().push, permission: async () => 'denied' } });
    await renderWithProviders(<SettingsScreen />);

    // A blocked row's name includes its hint.
    const row = await screen.findByRole('button', { name: /^Notifications, Turn them on/ });
    expect(row).toHaveAccessibilityValue({ text: 'Blocked' });
    expect(screen.getByText('Notifications are off')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SettingsScreen />);
    await user.press(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
  });

  it('deletes the account after confirmation', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SettingsScreen />);
    await user.press(screen.getByRole('button', { name: 'Delete account' }));
    await user.press(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
  });
});
