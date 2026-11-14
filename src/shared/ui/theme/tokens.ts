/** Design tokens shared by every theme. Components use these through `theme`, never directly. */

export const neutral = {
  0: '#FFFFFF',
  50: '#F3F5F8',
  100: '#E7ECF1',
  200: '#D6DDE6',
  300: '#B4BFCC',
  400: '#8792A1',
  500: '#6C7888',
  600: '#536071',
  700: '#2E3947',
  800: '#1D2631',
  850: '#151C25',
  900: '#121923',
  950: '#0E131A',
} as const;

export const feedback = {
  danger: { light: '#B42318', dark: '#F97066' },
  success: { light: '#1F7A4A', dark: '#62C58C' },
  warning: { light: '#9A5A00', dark: '#E3A54E' },
} as const;

// @social-start
/**
 * "Sign in with Google" button colours. Fixed by Google's branding guidelines
 * (https://developers.google.com/identity/branding-guidelines): never restyle them with the app's brand.
 */
export const googleSignIn = {
  light: { fill: '#FFFFFF', stroke: '#747775', text: '#1F1F1F' },
  dark: { fill: '#131314', stroke: '#8E918F', text: '#E3E3E3' },
} as const;
// @social-end

/** 4 pt grid. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = { none: 0, sm: 6, md: 10, lg: 16, xl: 24, full: 999 } as const;

/**
 * Type scale. Sizes are in points and scale with the user's text-size setting
 * (allowFontScaling stays on; Text caps it at 2×).
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (Apple HIG 44 pt, Material 48 dp). */
export const MIN_TOUCH = 44;

export const breakpoints = { xs: 0, sm: 380, md: 768, lg: 1024, xl: 1280 } as const;
