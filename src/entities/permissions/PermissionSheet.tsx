import type { Ref } from 'react';

import { useTranslation } from '@/shared/i18n';
import type { PermissionKind } from '@/shared/ports';
import { Bell, BellOff, type LucideIcon } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/primitives/Button';
import { Icon } from '@/shared/ui/primitives/Icon';
import { Sheet, type SheetRef } from '@/shared/ui/primitives/Sheet';
import { Text } from '@/shared/ui/primitives/Text';

/** What the sheet says for each kind: why the app asks, and how to undo a "Don't allow". */
const COPY = {
  notifications: {
    icon: Bell,
    blockedIcon: BellOff,
    title: 'permissions.notificationsTitle',
    body: 'permissions.notificationsBody',
    blockedTitle: 'permissions.notificationsBlockedTitle',
    blockedBody: 'permissions.notificationsBlockedBody',
  },
} as const satisfies Record<PermissionKind, SheetCopy>;

type SheetCopy = {
  icon: LucideIcon;
  blockedIcon: LucideIcon;
  title: string;
  body: string;
  blockedTitle: string;
  blockedBody: string;
};

export type PermissionSheetProps = {
  ref: Ref<SheetRef>;
  kind: PermissionKind;
  /** The OS won't prompt again, so the sheet sends people to the system settings. */
  blocked: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

/** The explanation shown before a system permission prompt. Driven by `usePermission`. */
export function PermissionSheet({
  ref,
  kind,
  blocked,
  onContinue,
  onCancel,
}: PermissionSheetProps) {
  const { t } = useTranslation();
  const copy = COPY[kind];
  return (
    <Sheet ref={ref}>
      <Icon icon={blocked ? copy.blockedIcon : copy.icon} size={28} tone="primary" />
      <Text variant="heading">{t(blocked ? copy.blockedTitle : copy.title)}</Text>
      <Text tone="muted">{t(blocked ? copy.blockedBody : copy.body)}</Text>
      <Button
        title={blocked ? t('permissions.openSettings') : t('common.continue')}
        onPress={onContinue}
        fullWidth
      />
      <Button title={t('permissions.notNow')} variant="secondary" onPress={onCancel} fullWidth />
    </Sheet>
  );
}
