import { screen, userEvent } from '@testing-library/react-native';

import type { Permissions, PermissionStatus } from '@/shared/ports';
import { setServices } from '@/shared/services/services';
import { Button } from '@/shared/ui/primitives/Button';
import { Text } from '@/shared/ui/primitives/Text';
import { renderWithProviders } from '@/test/render';

import { PermissionSheet } from './PermissionSheet';
import { usePermission } from './use-permission';

function Harness() {
  const notifications = usePermission('notifications');
  return (
    <>
      <Text>{`status:${notifications.status}`}</Text>
      <Button title="Ask" onPress={notifications.ask} />
      <PermissionSheet {...notifications.sheet} />
    </>
  );
}

function fakePermissions(initial: PermissionStatus) {
  let status = initial;
  const permissions = {
    check: jest.fn(async () => status),
    request: jest.fn(async () => {
      status = 'granted';
      return status;
    }),
    openSettings: jest.fn(async () => {}),
  } satisfies Permissions;
  setServices({ permissions });
  return permissions;
}

describe('usePermission', () => {
  it('explains first, then shows the system prompt on Continue', async () => {
    const permissions = fakePermissions('not-determined');
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    expect(await screen.findByText('status:not-determined')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByText('Turn on notifications')).toBeOnTheScreen();
    expect(permissions.request).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Continue' }));
    expect(permissions.request).toHaveBeenCalledWith('notifications');
    expect(await screen.findByText('status:granted')).toBeOnTheScreen();
  });

  it('sends people to the system settings once the OS stops prompting', async () => {
    const permissions = fakePermissions('denied');
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    expect(await screen.findByText('Notifications are off')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Open settings' }));
    expect(permissions.openSettings).toHaveBeenCalled();
    expect(permissions.request).not.toHaveBeenCalled();
  });

  it('asks nothing when the person picks Not now', async () => {
    const permissions = fakePermissions('not-determined');
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await screen.findByText('status:not-determined');
    await user.press(screen.getByRole('button', { name: 'Not now' }));
    expect(permissions.request).not.toHaveBeenCalled();
  });
});
