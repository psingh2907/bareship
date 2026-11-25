import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTranslation } from '@/shared/i18n';
import { SquarePen } from '@/shared/ui/icons';
import { Icon } from '@/shared/ui/primitives/Icon';
import { MIN_TOUCH } from '@/shared/ui/theme/tokens';

/** The feed header's "New post" button. */
export function NewPostButton() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  return (
    <Pressable
      role="button"
      aria-label={t('feed.newPost')}
      onPress={() => navigation.navigate('NewPost')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="feed-new-post"
    >
      <Icon icon={SquarePen} tone="primary" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create(theme => ({
  button: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: theme.spacing.sm,
  },
  pressed: { opacity: 0.6 },
}));
