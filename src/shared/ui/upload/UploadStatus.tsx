import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { useTranslation } from '@/shared/i18n';
import { CircleAlert, Clock } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/primitives/Button';
import { Icon } from '@/shared/ui/primitives/Icon';
import { Text } from '@/shared/ui/primitives/Text';

export type UploadState = 'uploading' | 'waiting' | 'failed';

export type UploadStatusProps = {
  state: UploadState;
  /** 0–1 while uploading; undefined until the first bytes are sent. */
  progress?: number;
  /** Stops an upload or takes a waiting one out of the queue. */
  onRemove: () => void;
  /** Shown when the upload failed. */
  onRetry: () => void;
};

/**
 * One upload's state under its preview: a progress bar while uploading, "Waiting to upload" while
 * offline, and Try again / Remove after it failed. Purely presentational: the screen passes the
 * state (see docs/uploads.md).
 */
export function UploadStatus({ state, progress, onRemove, onRetry }: UploadStatusProps) {
  const { t } = useTranslation();

  if (state === 'failed') {
    return (
      <View style={styles.root} aria-live="polite">
        <View style={styles.row}>
          <Icon icon={CircleAlert} tone="danger" size={18} />
          <Text variant="caption" tone="danger" style={styles.label}>
            {t('upload.failed')}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title={t('upload.retry')} size="sm" variant="secondary" onPress={onRetry} />
          <Button title={t('upload.remove')} size="sm" variant="ghost" onPress={onRemove} />
        </View>
      </View>
    );
  }

  if (state === 'waiting') {
    return (
      <View style={styles.root} aria-live="polite">
        <View style={styles.row}>
          <Icon icon={Clock} tone="textMuted" size={18} />
          <Text variant="caption" tone="muted" style={styles.label}>
            {t('upload.waiting')}
          </Text>
          <Button title={t('upload.remove')} size="sm" variant="ghost" onPress={onRemove} />
        </View>
      </View>
    );
  }

  const percent = Math.round((progress ?? 0) * 100);
  return (
    <View style={styles.root}>
      <View
        style={styles.track}
        role="progressbar"
        aria-label={t('upload.uploadingLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        {/* A CSS transition (Reanimated 4) animates the width on the UI thread between progress events. */}
        <Animated.View
          style={[styles.fill, { width: `${Math.max(percent, 2)}%`, ...WIDTH_TRANSITION }]}
        />
      </View>
      <View style={styles.row}>
        <Text variant="caption" tone="muted" style={styles.label}>
          {progress === undefined ? t('upload.preparing') : t('upload.uploading', { percent })}
        </Text>
        <Button title={t('upload.cancel')} size="sm" variant="ghost" onPress={onRemove} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  root: { gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 36 },
  label: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  track: {
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
}));

// Kept out of the Unistyles sheet: Reanimated reads CSS transition props from the style it's given.
const WIDTH_TRANSITION = {
  transitionProperty: 'width',
  transitionDuration: 250,
  transitionTimingFunction: 'ease-out',
} as const;
