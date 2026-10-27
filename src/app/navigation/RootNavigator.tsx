import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createStaticNavigation,
  getFocusedRouteNameFromRoute,
  type StaticParamList,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ParseKeys } from 'i18next';

import { useIsSignedIn, useIsSignedOut } from '@/entities/session/session-store';
import { ForgotPasswordScreen, LoginScreen, RegisterScreen } from '@/features/auth';
import { FeedScreen, PostScreen } from '@/features/feed'; // @example:home-import
import { OnboardingScreen, useNeedsOnboarding, useOnboardingDone } from '@/features/onboarding';
import { SettingsScreen } from '@/features/settings';
import { ShowroomScreen } from '@/features/showroom'; // @example
import { i18n, useTranslation } from '@/shared/i18n';
import { Home, Settings } from '@/shared/ui/icons';

import { TabIcon, TranslatedText } from './labels';
import { offlineLayout } from './offline-layout';

const Tabs = createBottomTabNavigator({
  screenOptions: { headerShadowVisible: false },
  screenLayout: offlineLayout,
  screens: {
    // @example-start:home-tab (pnpm strip-examples replaces the demo with a blank Home tab)
    Feed: {
      screen: FeedScreen,
      linking: 'feed',
      options: {
        headerTitle: () => <TranslatedText i18nKey="feed.title" />,
        tabBarLabel: ({ color }) => <TranslatedText i18nKey="tabs.feed" color={color} small />,
        tabBarIcon: ({ color, size }) => <TabIcon icon={Home} color={color} size={size} />,
        tabBarButtonTestID: 'tab-feed',
      },
    },
    // @example-end
    Settings: {
      screen: SettingsScreen,
      linking: 'settings',
      options: {
        headerTitle: () => <TranslatedText i18nKey="settings.title" />,
        tabBarLabel: ({ color }) => <TranslatedText i18nKey="tabs.settings" color={color} small />,
        tabBarIcon: ({ color, size }) => <TabIcon icon={Settings} color={color} size={size} />,
        tabBarButtonTestID: 'tab-settings',
      },
    },
  },
});

// The focused tab's title names the Main route, so a screen pushed over the tabs gets it as its iOS back
// label instead of "Main". The first entry is the tab that shows first.
const TAB_TITLES = [
  ['Feed', 'feed.title'], // @example:home-title
  ['Settings', 'settings.title'],
] as const satisfies readonly (readonly [string, ParseKeys])[];

function tabTitle(route: Parameters<typeof getFocusedRouteNameFromRoute>[0]) {
  // Until the tabs report a focused route, the first tab is the one showing.
  const name = getFocusedRouteNameFromRoute(route);
  const [, key] = TAB_TITLES.find(([tab]) => tab === name) ?? TAB_TITLES[0];
  return i18n.t(key);
}

// Gates. While the session is "unknown" (still restoring) no group matches and the splash stays up.
// Call every hook unconditionally (no `&&` between hook calls).
function useShowSignedOut() {
  const signedOut = useIsSignedOut();
  const onboarded = useOnboardingDone();
  return signedOut && onboarded;
}
function useShowSignedIn() {
  const signedIn = useIsSignedIn();
  const onboarded = useOnboardingDone();
  return signedIn && onboarded;
}

const RootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  // A deep link that arrives while signed out (or during onboarding) opens once its screen exists,
  // i.e. right after sign-in, instead of being dropped. "UNSTABLE" in React Navigation 7; covered by
  // App.test.tsx so an upgrade that changes it fails loudly.
  UNSTABLE_routeNamesChangeBehavior: 'lastUnhandled',
  groups: {
    Onboarding: {
      if: useNeedsOnboarding,
      screens: { Onboarding: OnboardingScreen },
    },
    SignedOut: {
      if: useShowSignedOut,
      screens: {
        Login: { screen: LoginScreen, linking: 'login' },
        Register: { screen: RegisterScreen, linking: 'register' },
        ForgotPassword: { screen: ForgotPasswordScreen, linking: 'forgot-password' },
      },
    },
    SignedIn: {
      if: useShowSignedIn,
      screens: {
        Main: { screen: Tabs, linking: '', options: ({ route }) => ({ title: tabTitle(route) }) },
        // @example-start
        Post: {
          screen: PostScreen,
          linking: 'post/:id',
          layout: offlineLayout,
          options: { headerShown: true, title: '', headerBackButtonDisplayMode: 'minimal' },
        },
        // @example-end
        // gen:screens (`pnpm gen` adds screens above this line)
        // @example-start
        ...(__DEV__
          ? {
              Showroom: {
                screen: ShowroomScreen,
                layout: offlineLayout,
                options: () => ({ headerShown: true, title: i18n.t('settings.showroom') }),
              },
            }
          : {}),
        // @example-end
      },
    },
  },
});

// Options functions (string titles, back labels) run when the navigator renders. Re-rendering it on a
// language switch keeps them in the new language without a restart.
const LocalizedRootStack = RootStack.with(function LocalizedNavigator({ Navigator }) {
  useTranslation();
  return <Navigator />;
});

export const Navigation = createStaticNavigation(LocalizedRootStack);

type RootStackParamList = StaticParamList<typeof LocalizedRootStack>;

// Makes useNavigation().navigate(route, params) type-checked anywhere, without imports.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
