// Styles and types are statics on AppleButton: the library's separately exported enums are type-only.
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { SocialProvider } from '@/shared/ports';

type SocialButtonProps = {
  provider: SocialProvider;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * The providers' own buttons, so the branding follows Apple's and Google's rules (ADR 0020): Apple's
 * is black on light screens and white on dark, Google's follows the theme too. Both are native views
 * with their own accessibility labels, localized by the system.
 */
export function SocialButton({ provider, onPress, disabled = false, testID }: SocialButtonProps) {
  const { theme } = useUnistyles();
  const dark = theme.scheme === 'dark';

  if (provider === 'apple') {
    // AppleButton has no disabled state: block touches and dim it instead.
    return (
      <View
        style={styles.wrapper(disabled)}
        pointerEvents={disabled ? 'none' : 'auto'}
        aria-disabled={disabled}
      >
        <AppleButton
          buttonType={AppleButton.Type.CONTINUE}
          buttonStyle={dark ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
          cornerRadius={theme.radius.md}
          style={styles.apple}
          onPress={onPress}
          testID={testID}
        />
      </View>
    );
  }

  return (
    <GoogleSigninButton
      size={GoogleSigninButton.Size.Wide}
      color={dark ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
      style={styles.google}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
    />
  );
}

const BUTTON_HEIGHT = 48;

const styles = StyleSheet.create({
  wrapper: (disabled: boolean) => ({ opacity: disabled ? 0.5 : 1 }),
  apple: { width: '100%', height: BUTTON_HEIGHT },
  google: { width: '100%', height: BUTTON_HEIGHT },
});
