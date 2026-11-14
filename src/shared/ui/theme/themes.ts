import { ACTIVE_BRAND, type BrandPalette, BRANDS } from './brands';
import { feedback, googleSignIn, neutral, radius, spacing, typography } from './tokens'; // @social:theme-tokens-import

export type ColorScheme = 'light' | 'dark';

function colors(scheme: ColorScheme, brand: BrandPalette) {
  const light = scheme === 'light';
  return {
    background: light ? neutral[50] : neutral[950],
    surface: light ? neutral[0] : neutral[850],
    surfaceMuted: light ? neutral[100] : neutral[800],
    border: light ? neutral[200] : neutral[700],
    text: light ? neutral[900] : neutral[50],
    textMuted: light ? neutral[600] : neutral[400],
    textSubtle: light ? neutral[500] : neutral[500],
    primary: light ? brand.primary : brand.primaryDark,
    primaryPressed: light ? brand.primaryPressed : brand.primaryDarkPressed,
    onPrimary: light ? brand.onPrimary : brand.onPrimaryDark,
    danger: feedback.danger[scheme],
    onDanger: light ? '#FFFFFF' : '#2B0A07',
    success: feedback.success[scheme],
    warning: feedback.warning[scheme],
    skeleton: light ? neutral[200] : neutral[800],
    overlay: light ? 'rgba(18, 25, 35, 0.4)' : 'rgba(0, 0, 0, 0.6)',
  };
}

export function createTheme(scheme: ColorScheme, brand: BrandPalette = BRANDS[ACTIVE_BRAND]) {
  return {
    scheme,
    colors: colors(scheme, brand),
    // @social-start
    /** Third-party sign-in buttons, in the colours the provider fixes for this scheme (ADR 0020). */
    signIn: { google: googleSignIn[scheme] },
    // @social-end
    spacing,
    radius,
    typography,
    /** Spacing helper on the 4 pt grid: gap(3) === 12. */
    gap: (units: number) => units * 4,
  };
}

export const themes = {
  light: createTheme('light'),
  dark: createTheme('dark'),
};

export type AppTheme = ReturnType<typeof createTheme>;
