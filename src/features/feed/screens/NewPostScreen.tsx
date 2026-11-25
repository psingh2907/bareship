import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles, withUnistyles } from 'react-native-unistyles';

import { PermissionSheet } from '@/entities/permissions/PermissionSheet';
import { usePermission } from '@/entities/permissions/use-permission';
import { useSession } from '@/entities/session/session-store';
import { createId } from '@/shared/api/id';
import { useTranslation } from '@/shared/i18n';
import { useIsOnline } from '@/shared/lifecycle/network';
import type { PhotoSource, PickedPhoto } from '@/shared/ports';
import { Camera, ImagePlus, X } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/primitives/Button';
import { Icon } from '@/shared/ui/primitives/Icon';
import { Image } from '@/shared/ui/primitives/Image';
import { Text } from '@/shared/ui/primitives/Text';
import { MIN_TOUCH } from '@/shared/ui/theme/tokens';
import { toast } from '@/shared/ui/toast/toast-store';

import { pickPostPhoto, useCreatePost } from '../api';

const MAX_LENGTH = 500;

const ThemedTextInput = withUnistyles(TextInput, theme => ({
  placeholderTextColor: theme.colors.textSubtle,
  selectionColor: theme.colors.primary,
}));

/**
 * Writes a post, with an optional photo from the library or the camera. Posting closes the screen at
 * once: the post goes through the offline queue (`useCreatePost`), so it works with no connection.
 */
export function NewPostScreen() {
  const { t } = useTranslation();
  const { rt } = useUnistyles();
  const navigation = useNavigation();
  const user = useSession(state => state.user);
  const online = useIsOnline();
  const createPost = useCreatePost();
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [posting, setPosting] = useState(false);

  const pick = async (source: PhotoSource) => {
    try {
      const picked = await pickPostPhoto(source);
      if (picked) setPhoto(picked);
    } catch {
      toast.error(t('feed.photoFailed'));
    }
  };
  // The camera explains itself before the system prompt, and opens once access is granted.
  const camera = usePermission('camera', { onGranted: () => pick('camera') });

  const text = body.trim();
  const canPost = (text.length > 0 || photo !== null) && !posting;

  const post = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      // Keeps the photo on the phone and queues the post; it works with no connection.
      await createPost.start(photo, {
        postId: createId(),
        body: text,
        createdAt: new Date().toISOString(),
      });
      navigation.goBack();
    } catch {
      setPosting(false);
      toast.error(t('feed.photoFailed'));
    }
  };

  return (
    <View style={styles.root} testID="new-post-screen">
      {/* Its own header: in the iOS sheet and on Android alike, SafeAreaView measures the real inset. */}
      <SafeAreaView edges={['top']} style={styles.headerArea}>
        <View style={styles.header}>
          <Button
            title={t('common.cancel')}
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
          />
          <Text variant="heading" align="center" style={styles.title}>
            {t('feed.newPost')}
          </Text>
          <Button
            title={t('feed.post')}
            size="sm"
            disabled={!canPost}
            loading={posting}
            onPress={post}
            testID="new-post-submit"
          />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={72}
      >
        <View style={styles.author}>
          {user?.avatarUrl ? (
            <Image uri={user.avatarUrl} style={styles.avatar} priority="low" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text variant="label" tone="muted">
                {user?.name.slice(0, 1) ?? ''}
              </Text>
            </View>
          )}
          <Text variant="label">{user?.name}</Text>
        </View>

        <ThemedTextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('feed.composePlaceholder')}
          aria-label={t('feed.composePlaceholder')}
          multiline
          autoFocus
          maxLength={MAX_LENGTH}
          style={styles.input}
          testID="new-post-body"
        />

        {photo ? (
          <View style={styles.preview}>
            <Image
              uri={photo.uri}
              style={styles.photo(photo.width, photo.height)}
              resizeMode="cover"
            />
            <Pressable
              role="button"
              aria-label={t('feed.removePhoto')}
              onPress={() => setPhoto(null)}
              hitSlop={8}
              style={styles.removePhoto}
              testID="new-post-remove-photo"
            >
              <Icon icon={X} tone="text" size={18} />
            </Pressable>
          </View>
        ) : null}

        {!online ? (
          <Text variant="caption" tone="muted">
            {t('feed.offlineCompose')}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: rt.insets.bottom }}>
        <View style={styles.toolbar}>
          <ToolbarButton
            icon={ImagePlus}
            label={t('feed.addPhoto')}
            onPress={() => pick('library')}
            testID="new-post-library"
          />
          {camera.status !== 'unavailable' ? (
            <ToolbarButton
              icon={Camera}
              label={t('feed.takePhoto')}
              onPress={camera.ask}
              testID="new-post-camera"
            />
          ) : null}
          <Text variant="caption" tone="subtle" style={styles.count}>
            {body.length > MAX_LENGTH - 100 ? `${body.length}/${MAX_LENGTH}` : ''}
          </Text>
        </View>
      </KeyboardStickyView>

      <PermissionSheet {...camera.sheet} />
    </View>
  );
}

function ToolbarButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: typeof Camera;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
      testID={testID}
    >
      <Icon icon={icon} tone="primary" size={22} />
      <Text variant="label" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}

// A photo shows in its own shape, between a 4:5 portrait and a 1.91:1 landscape (common feed limits).
const aspect = (width: number, height: number) =>
  width > 0 && height > 0 ? Math.min(Math.max(width / height, 0.8), 1.91) : 4 / 3;

const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  headerArea: { backgroundColor: theme.colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    maxWidth: { xs: undefined, md: 640 },
    width: '100%',
    alignSelf: 'center',
  },
  author: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  avatar: { width: 40, height: 40, borderRadius: theme.radius.full },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  input: {
    ...theme.typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.text,
    minHeight: 96,
    textAlignVertical: 'top',
    padding: 0,
  },
  preview: { borderRadius: theme.radius.lg, overflow: 'hidden' },
  photo: (width: number, height: number) => ({
    width: '100%',
    aspectRatio: aspect(width, height),
    backgroundColor: theme.colors.surfaceMuted,
  }),
  removePhoto: {
    position: 'absolute',
    top: theme.spacing.sm,
    end: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    // The theme's surface with a hairline: readable over any photo, light or dark.
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: rt.insets.bottom + theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: MIN_TOUCH,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
  },
  toolPressed: { backgroundColor: theme.colors.surfaceMuted },
  count: { marginStart: 'auto', paddingHorizontal: theme.spacing.sm },
}));
