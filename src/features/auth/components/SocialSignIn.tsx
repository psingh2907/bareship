import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTranslation } from '@/shared/i18n';
import { useIsOnline } from '@/shared/lifecycle/network';
import { services } from '@/shared/services/services';
import { SocialButton } from '@/shared/ui/primitives/SocialButton';
import { Stack } from '@/shared/ui/primitives/Stack';
import { errorMessage } from '@/shared/ui/primitives/States';
import { Text } from '@/shared/ui/primitives/Text';

import { hasErrorCode, useSocialSignIn } from '../hooks/useAuthMutations';

/**
 * "or" and a button per provider configured for this build (ADR 0020). Renders nothing when no
 * provider is set up. Offline pattern C: the buttons are disabled with no connection; the screen's
 * own OfflineNotice says why.
 */
export function SocialSignIn() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const social = useSocialSignIn();
  const providers = services().social.providers();
  if (providers.length === 0) return null;

  const failure = social.error
    ? hasErrorCode(social.error, 'account_exists')
      ? t('auth.social.accountExists')
      : errorMessage(social.error, t)
    : null;

  return (
    <Stack gap="md">
      <View style={styles.separator}>
        <View style={styles.line} />
        <Text variant="caption" tone="muted">
          {t('auth.social.or')}
        </Text>
        <View style={styles.line} />
      </View>
      {providers.map(provider => (
        <SocialButton
          key={provider}
          provider={provider}
          label={t('auth.social.continueWithGoogle')}
          disabled={!online || social.isPending}
          onPress={() => social.mutate(provider)}
          testID={`social-${provider}`}
        />
      ))}
      {failure ? (
        <Text tone="danger" aria-live="polite" testID="social-error">
          {failure}
        </Text>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create(theme => ({
  separator: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
}));
