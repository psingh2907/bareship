// Styles and types are statics on AppleButton: the library's separately exported enums are type-only.
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { SocialProvider } from '@/shared/ports';

import googleG from './assets/google-g.png';

type SocialButtonProps = {
  provider: SocialProvider;
  /** The Google button's text, translated ("Continue with Google"). Apple's button brings its own. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Sizes from Google's official button assets (signin-assets.zip, "Square" shape): iOS buttons are 44 pt
 * tall, Android ones 40 dp, both with a 4-point corner radius and a 20-point "G". Padding is from the
 * guidelines' padding table: before the G, between the G and the text, after the text.
 */
const GOOGLE_SPEC =
  Platform.OS === 'ios'
    ? { height: 44, paddingStart: 16, gap: 12, paddingEnd: 16 }
    : { height: 40, paddingStart: 12, gap: 10, paddingEnd: 12 };
const CORNER_RADIUS = 4;
const G_SIZE = 20;
/** Google Sans Medium, as SignInSans (see assets/fonts/README.md). */
const GOOGLE_FONT = 'SignInSans-Medium';

/**
 * Sign-in buttons that follow each provider's rules (ADR 0020).
 *
 * - Apple: Apple's own `ASAuthorizationAppleIDButton`, black on light screens and white on dark. Its text
 *   is localized by the system, in the phone's language.
 * - Google: drawn here to Google's current branding guidelines
 *   (https://developers.google.com/identity/branding-guidelines): the official "G" at 20 points on the
 *   light or dark theme colours, Google Sans Medium 14/20, Google's padding per platform. The text comes
 *   from the app's own strings, so it follows the app's language.
 *
 * Both share the Google button's height and corner radius, so neither looks more prominent, as Google's
 * guidelines ask.
 */
export function SocialButton({
  provider,
  label,
  onPress,
  disabled = false,
  testID,
}: SocialButtonProps) {
  const { theme } = useUnistyles();
  const dark = theme.scheme === 'dark';

  if (provider === 'apple') {
    // AppleButton has no disabled state: block touches and dim it instead.
    return (
      <View
        style={styles.disabled(disabled)}
        pointerEvents={disabled ? 'none' : 'auto'}
        aria-disabled={disabled}
      >
        <AppleButton
          buttonType={AppleButton.Type.CONTINUE}
          buttonStyle={dark ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
          cornerRadius={CORNER_RADIUS}
          style={styles.apple}
          onPress={onPress}
          testID={testID}
        />
      </View>
    );
  }

  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.google, styles.disabled(disabled)]}
    >
      {({ pressed }) => (
        <>
          {/* Pressed: a state layer under the content, so the G and the colours stay Google's. */}
          {pressed ? <View style={styles.pressedLayer} pointerEvents="none" /> : null}
          {/* The G is Google's own image, never resized out of proportion or recoloured. */}
          <Image source={googleG} style={styles.googleG} resizeMode="contain" aria-hidden />
          <Text style={styles.googleText} numberOfLines={1} maxFontSizeMultiplier={1.5}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create(theme => ({
  // Material's disabled opacity, which Google's own buttons use too.
  disabled: (disabled: boolean) => ({ opacity: disabled ? 0.38 : 1 }),
  apple: { width: '100%', height: GOOGLE_SPEC.height },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: GOOGLE_SPEC.height,
    paddingStart: GOOGLE_SPEC.paddingStart,
    paddingEnd: GOOGLE_SPEC.paddingEnd,
    gap: GOOGLE_SPEC.gap,
    borderRadius: CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.signIn.google.stroke,
    backgroundColor: theme.signIn.google.fill,
    overflow: 'hidden',
  },
  // Material's pressed state layer: the text colour at 10%.
  pressedLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.signIn.google.text,
    opacity: 0.1,
  },
  googleG: { width: G_SIZE, height: G_SIZE },
  googleText: {
    flexShrink: 1,
    fontFamily: GOOGLE_FONT,
    fontSize: 14,
    lineHeight: 20,
    color: theme.signIn.google.text,
  },
}));
