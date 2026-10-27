import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTranslation } from '@/shared/i18n';
import { EmptyState, ErrorState } from '@/shared/ui/primitives/States';
import { Text } from '@/shared/ui/primitives/Text';

import { feedQueryOptions, useToggleLike, useWaitingLikes } from '../api';
import { PostCard } from '../components/PostCard';
import { PostCardSkeleton } from '../components/PostCardSkeleton';

export function FeedScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const feed = useInfiniteQuery(feedQueryOptions());
  const toggleLike = useToggleLike();
  const waitingLikes = useWaitingLikes();
  const posts = useMemo(() => feed.data?.pages.flatMap(page => page.items) ?? [], [feed.data]);

  if (feed.isPending) {
    return (
      <View style={styles.root} testID="feed-loading">
        {Array.from({ length: 5 }, (_, index) => (
          <PostCardSkeleton key={index} />
        ))}
      </View>
    );
  }

  if (feed.isError && posts.length === 0) {
    return (
      <View style={styles.root}>
        <ErrorState
          error={feed.error}
          title={t('feed.errorTitle')}
          onRetry={() => feed.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="feed-screen">
      <FlashList
        data={posts}
        keyExtractor={post => post.id}
        // Rows with and without an image recycle from separate pools, so a recycled row keeps its layout.
        getItemType={post => (post.imageUrl ? 'image' : 'text')}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('Post', { id: item.id })}
            onToggleLike={() => toggleLike.mutate({ postId: item.id, like: !item.likedByMe })}
            likePending={waitingLikes.has(item.id)}
          />
        )}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => {
              feed.refetch();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={<EmptyState title={t('feed.emptyTitle')} body={t('feed.emptyBody')} />}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={theme.colors.primary} />
          ) : !feed.hasNextPage && posts.length > 0 ? (
            <Text tone="subtle" align="center" style={styles.footer}>
              {t('feed.endOfFeed')}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  footer: { padding: theme.spacing.xl },
}));
