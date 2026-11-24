import { Linking } from 'react-native';

import type { PermissionKind, Permissions, PermissionStatus } from '@/shared/ports';

/** How one kind of permission is read and requested. */
export type PermissionHandler = {
  check(): Promise<PermissionStatus>;
  request(): Promise<PermissionStatus>;
};

/**
 * Routes each kind to its handler. Notifications go through the push port; a kind that needs
 * react-native-permissions (camera, photos, location) gets a handler built on it (docs/permissions.md).
 */
export function createPermissions(
  handlers: Record<PermissionKind, PermissionHandler>,
): Permissions {
  return {
    check: kind => handlers[kind].check(),
    request: kind => handlers[kind].request(),
    openSettings: () => Linking.openSettings(),
  };
}
