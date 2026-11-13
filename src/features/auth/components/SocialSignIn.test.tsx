import { onlineManager } from '@tanstack/react-query';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';

import { useSession } from '@/entities/session/session-store';
import { createMockSocialSignIn } from '@/mocks/social';
import { setServices } from '@/shared/services/services';
import { renderWithProviders } from '@/test/render';

import { SocialSignIn } from './SocialSignIn';

describe('SocialSignIn', () => {
  it('renders nothing when no provider is configured', async () => {
    await renderWithProviders(<SocialSignIn />);
    expect(screen.queryByText('or')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('signs in with the mock provider through the backend', async () => {
    setServices({ social: createMockSocialSignIn() });
    const user = userEvent.setup();
    await renderWithProviders(<SocialSignIn />);

    expect(screen.getByRole('button', { name: 'Apple' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Google' }));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(useSession.getState().user?.email).toBe('demo@example.com');
  });

  it('stays signed out, with no error, when the user cancels', async () => {
    const social = createMockSocialSignIn();
    setServices({ social: { ...social, signIn: async () => null } });
    const user = userEvent.setup();
    await renderWithProviders(<SocialSignIn />);

    await user.press(screen.getByRole('button', { name: 'Google' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Google' })).toBeEnabled());
    expect(useSession.getState().status).toBe('signedOut');
    expect(screen.queryByTestId('social-error')).not.toBeOnTheScreen();
  });

  it('shows an error when the backend rejects the token', async () => {
    const social = createMockSocialSignIn();
    setServices({
      social: {
        ...social,
        signIn: async provider => ({ provider, idToken: 'forged' }),
      },
    });
    const user = userEvent.setup();
    await renderWithProviders(<SocialSignIn />);

    await user.press(screen.getByRole('button', { name: 'Google' }));

    expect(await screen.findByTestId('social-error')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('disables the buttons while offline', async () => {
    setServices({ social: createMockSocialSignIn() });
    await renderWithProviders(<SocialSignIn />);
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByRole('button', { name: 'Google' })).toBeDisabled();
    await act(async () => onlineManager.setOnline(true));
    expect(screen.getByRole('button', { name: 'Google' })).toBeEnabled();
  });

  it('forgets the provider session on sign-out', async () => {
    const signOut = jest.fn(async () => {});
    setServices({ social: { ...createMockSocialSignIn(), signOut } });
    await useSession.getState().signOut('user');
    expect(signOut).toHaveBeenCalled();
  });
});
