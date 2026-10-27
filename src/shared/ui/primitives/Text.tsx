import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { AppTheme } from '../theme/themes';
import type { TypographyVariant } from '../theme/tokens';

export type TextTone =
  'default' | 'muted' | 'subtle' | 'primary' | 'onPrimary' | 'danger' | 'success';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Defaults to `start`: the reading side of the layout, so text mirrors with a right-to-left layout. */
  align?: 'start' | 'end' | 'center' | 'justify' | 'auto';
};

const HEADINGS: ReadonlySet<TypographyVariant> = new Set(['display', 'title', 'heading']);

const TONE_COLOR: Record<TextTone, keyof AppTheme['colors']> = {
  default: 'text',
  muted: 'textMuted',
  subtle: 'textSubtle',
  primary: 'primary',
  onPrimary: 'onPrimary',
  danger: 'danger',
  success: 'success',
};

/** All text in the app. Headings get the "heading" role; scaling is capped at 2×. */
export function Text({
  variant = 'body',
  tone = 'default',
  align,
  style,
  role,
  maxFontSizeMultiplier = 2,
  ...rest
}: TextProps) {
  return (
    <RNText
      role={role ?? (HEADINGS.has(variant) ? 'heading' : undefined)}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[styles.text(variant, tone), align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

// Dynamic functions, not `variants` + useVariants: see the Styling section of AGENTS.md.
const styles = StyleSheet.create(theme => ({
  text: (variant: TypographyVariant, tone: TextTone) => ({
    writingDirection: 'auto',
    // iOS aligns unset ('auto') text by its own script, so English text stays on the left in a
    // right-to-left layout. 'start' follows the layout direction on both platforms, as Android already
    // does for unset text.
    textAlign: 'start',
    ...theme.typography[variant],
    color: theme.colors[TONE_COLOR[tone]],
  }),
}));
