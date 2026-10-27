import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent } from '@testing-library/react-native';

import { queryClient } from '@/data/query-client';
import { useOnboarding } from '@/features/onboarding';
import { changeLanguage, i18n, initI18n } from '@/shared/i18n';
import { signInDemoUser } from '@/test/app';

import { Navigation } from './RootNavigator';

type JsonNode = ReturnType<typeof screen.toJSON>;

/**
 * The titles of the native stack's headers, bottom screen first. iOS labels a back button with the title
 * of the screen underneath, so the first one is the back label of a screen pushed over the tabs.
 */
function stackHeaderTitles() {
  const titles: unknown[] = [];
  const walk = (node: JsonNode | JsonNode[]) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'RNSScreenStackHeaderConfig') titles.push(node.props.title);
    node.children?.forEach(child => typeof child === 'object' && walk(child));
  };
  walk(screen.toJSON());
  return titles;
}

function renderNavigation() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BottomSheetModalProvider>
        <Navigation />
      </BottomSheetModalProvider>
    </QueryClientProvider>,
  );
}

describe('RootNavigator', () => {
  beforeEach(async () => {
    initI18n('en');
    useOnboarding.getState().complete();
    await signInDemoUser();
  });

  afterEach(async () => {
    await act(async () => {
      await changeLanguage('en');
    });
  });

  it('names the Main route after the focused tab, in the current language', async () => {
    const user = userEvent.setup();
    await renderNavigation();
    await user.press(await screen.findByTestId('tab-settings'));
    // iOS shows this as the back label of a screen pushed over the tabs, so it isn't "Main".
    expect(stackHeaderTitles()[0]).toBe('Settings');

    await act(async () => {
      await changeLanguage('hi');
    });

    expect(i18n.t('settings.title')).not.toBe('Settings');
    expect(stackHeaderTitles()[0]).toBe(i18n.t('settings.title'));
  });

  // @example-start
  it('titles a pushed screen and its back label in the new language after a switch', async () => {
    const user = userEvent.setup();
    await renderNavigation();
    await user.press(await screen.findByTestId('tab-settings'));
    await user.press(await screen.findByRole('button', { name: 'Component showroom' }));
    expect(stackHeaderTitles()).toEqual(['Settings', 'Component showroom']);

    await act(async () => {
      await changeLanguage('hi');
    });

    expect(stackHeaderTitles()).toEqual([i18n.t('settings.title'), i18n.t('settings.showroom')]);
  });
  // @example-end
});
