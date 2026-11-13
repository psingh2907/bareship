import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, userEvent } from '@testing-library/react-native';

import { SocialButton } from './SocialButton';

const ROOT = join(__dirname, '../../../..');

describe('SocialButton (Google)', () => {
  it('is a button named by its translated label, and calls onPress', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<SocialButton provider="google" label="Continue with Google" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("doesn't respond while disabled", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <SocialButton provider="google" label="Continue with Google" onPress={onPress} disabled />,
    );

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

const IOS_FONT = join(ROOT, 'assets/fonts/SignInSans-Medium.ttf');
const ANDROID_FONT = join(ROOT, 'android/app/src/main/assets/fonts/SignInSans-Medium.ttf');
// scripts/ci/check-strip-examples.sh tests a copy without the native folders: nothing to compare there.
const hasNativeFolders = existsSync(join(ROOT, 'android'));

describe('the sign-in font', () => {
  (hasNativeFolders ? it : it.skip)(
    'ships the same file to iOS and Android (assets/fonts/README.md)',
    () => {
      expect(readFileSync(ANDROID_FONT).equals(readFileSync(IOS_FONT))).toBe(true);
    },
  );
});
