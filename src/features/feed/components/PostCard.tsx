import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { type UploadItem, useUploadProgress } from '@/data/uploads';
import { useTranslation } from '@/shared/i18n';
import { useFormat } from '@/shared/lib/format';
import { Heart } from '@/shared/ui/icons';
import { Icon } from '@/shared/ui/primitives/Icon';
import { Image } from '@/shared/ui/primitives/Image';
import { Text } from '@/shared/ui/primitives/Text';
import { MIN_TOUCH } from '@/shared/ui/theme/tokens';
import { UploadStatus } from '@/shared/ui/upload/UploadStatus';

import type { Post } from '../schema';

export type PostCardProps = {
  post: Post;
  onPress?: () => void;
  onToggleLike: () => void;
  expanded?: boolean;
  /** The like is queued offline and not yet saved (offline pattern B). */
  likePending?: boolean;
  /** For a post made on this phone that the server doesn't have yet. */
  local?: {
    status: UploadItem['state'];
    photoUri: string | null;
    /** The upload's key, for its progress. */
    progressKey: string;
    onRetry: () => void;
    onRemove: () => void;
  };
};

export function PostCard({
  post,
  onPress,
  onToggleLike,
  expanded,
  likePending,
  local,
}: PostCardProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const likes = t('feed.likes', { count: post.likeCount });

  return (
    <View style={styles.card} testID={`post-card-${post.id}`}>
      <Pressable
        role={onPress ? 'button' : undefined}
        aria-label={`${post.author.name}. ${post.body}`}
        disabled={!onPress || Boolean(local)}
        onPress={onPress}
        style={styles.content}
        testID={`post-${post.id}`}
      >
        <View style={styles.header}>
          {post.author.avatarUrl ? (
            <Image uri={post.author.avatarUrl} style={styles.avatar} priority="low" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text variant="label" tone="muted">
                {post.author.name.slice(0, 1)}
              </Text>
            </View>
          )}
          <View style={styles.meta}>
            <Text variant="label">{post.author.name}</Text>
            <Text variant="caption" tone="muted">
              {format.relative(post.createdAt)}
            </Text>
          </View>
        </View>
        <Text numberOfLines={expanded ? undefined : 4}>{post.body}</Text>
        {local?.photoUri ? (
          <Image
            uri={local.photoUri}
            style={[styles.image, local.status !== 'failed' && styles.unsent]}
            resizeMode="cover"
          />
        ) : post.imageUrl ? (
          <Image uri={post.imageUrl} style={styles.image} resizeMode="cover" />
        ) : null}
      </Pressable>
      {local ? (
        <LocalPostStatusRow {...local} />
      ) : (
        <Pressable
          role="button"
          aria-label={post.likedByMe ? t('feed.unlike') : t('feed.like')}
          aria-selected={post.likedByMe}
          aria-valuetext={likes}
          accessibilityHint={likePending ? t('offline.waiting') : undefined}
          onPress={onToggleLike}
          hitSlop={8}
          style={styles.like}
          testID={`like-${post.id}`}
        >
          <Icon icon={Heart} tone={post.likedByMe ? 'danger' : 'textMuted'} size={20} />
          <Text variant="caption" tone="muted">
            {likes}
          </Text>
          {likePending ? (
            <Text variant="caption" tone="subtle" testID={`like-pending-${post.id}`}>
              {t('offline.waiting')}
            </Text>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

/** Its own component, so upload progress re-renders this row, not the whole card. */
function LocalPostStatusRow({
  progressKey,
  status,
  onRetry,
  onRemove,
}: NonNullable<PostCardProps['local']>) {
  const progress = useUploadProgress(progressKey);
  return (
    <View style={styles.status} testID="local-post-status">
      <UploadStatus state={status} progress={progress} onRetry={onRetry} onRemove={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  content: { gap: theme.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  avatar: { width: 40, height: 40, borderRadius: theme.radius.full },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  meta: { flex: 1, gap: theme.spacing.xxs },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: theme.radius.md },
  unsent: { opacity: 0.6 },
  status: { paddingBottom: theme.spacing.sm },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    minHeight: MIN_TOUCH,
  },
}));
