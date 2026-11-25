import { useNavigation } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTranslation } from '@/shared/i18n';
import { EmptyState, ErrorState } from '@/shared/ui/primitives/States';
import { Text } from '@/shared/ui/primitives/Text';

import { feedQueryOptions, useToggleLike, useUnsentPosts, useWaitingLikes } from '../api';
import { PostCard } from '../components/PostCard';
import { PostCardSkeleton } from '../components/PostCardSkeleton';
import type { Post } from '../schema';

export function FeedScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const feed = useInfiniteQuery(feedQueryOptions());
  const toggleLike = useToggleLike();
  const waitingLikes = useWaitingLikes();
  // Posts written on this phone that the server doesn't have yet go on top, from their saved uploads.
  const unsent = useUnsentPosts();
  const uploads = new Map(unsent.map(({ post, upload }) => [post.id, upload]));
  const loaded = useMemo(() => feed.data?.pages.flatMap(page => page.items) ?? [], [feed.data]);
  const posts = [
    ...unsent.map(({ post }) => post),
    ...loaded.filter(post => !uploads.has(post.id)),
  ];
  const list = useRef<FlashListRef<Post>>(null);

  // A post you just wrote goes on top: scroll up to it, after FlashList has laid it out.
  const newestOwnPost = posts[0]?.local ? posts[0].id : undefined;
  useEffect(() => {
    if (!newestOwnPost) return;
    const frame = requestAnimationFrame(() =>
      list.current?.scrollToOffset({ offset: 0, animated: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [newestOwnPost]);

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
        ref={list}
        data={posts}
        // On by default in FlashList 2: it would hold the old top row in place when your new post is
        // added above it. New items only arrive at the top here (your post, pull to refresh).
        maintainVisibleContentPosition={{ disabled: true }}
        keyExtractor={post => post.id}
        // Rows recycle from a pool per layout (with an image, text only, not yet sent), so a recycled
        // row keeps its layout.
        getItemType={post => (post.local ? 'local' : post.imageUrl ? 'image' : 'text')}
        renderItem={({ item }) => {
          const upload = uploads.get(item.id);
          return (
            <PostCard
              post={item}
              onPress={() => navigation.navigate('Post', { id: item.id })}
              onToggleLike={() => toggleLike.mutate({ postId: item.id, like: !item.likedByMe })}
              likePending={waitingLikes.has(item.id)}
              local={
                upload
                  ? {
                      status: upload.state,
                      photoUri: upload.localUri,
                      progressKey: upload.key,
                      onRetry: upload.retry,
                      onRemove: upload.remove,
                    }
                  : undefined
              }
            />
          );
        }}
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
