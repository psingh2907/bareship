# Permissions

The app explains why it needs a permission before the system asks for it. If someone has already said no
and the system won't ask again, the app tells them how to turn it back on in their phone's settings.

Apple and Google both recommend this: people say yes more often when they know why, and a "Don't allow"
in the system prompt is hard to undo.

<p align="center">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/09-permission.png" alt="Android: before the system prompt, a sheet explains notifications, with Continue and Not now" width="240">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/09-permission-blocked.png" alt="iOS: after a Don't Allow, the sheet says notifications are off and offers Open settings" width="240">
</p>

Out of the box the app asks for one permission, notifications, from the Notifications row in Settings. It
declares no other permissions, so your app doesn't list camera or location access it never uses.

## Ask for a permission

Use the `usePermission` hook and render its sheet once on the screen:

```tsx
import { PermissionSheet } from '@/entities/permissions/PermissionSheet';
import { usePermission } from '@/entities/permissions/use-permission';

export function AlertsScreen() {
  const notifications = usePermission('notifications');
  return (
    <>
      <Button title={t('alerts.turnOn')} onPress={notifications.ask} />
      <PermissionSheet {...notifications.sheet} />
    </>
  );
}
```

`ask()` does nothing when the permission is already granted. Otherwise it opens the sheet:

| Status | The sheet shows | Its main button |
| --- | --- | --- |
| `not-determined` | Why the app needs the permission | **Continue** shows the system prompt |
| `denied` | That it's off, and where to turn it on | **Open settings** opens the app's page in the system settings |

`status` is `'unknown'` until the first read, then one of `granted`, `denied` or `not-determined`. The hook
reads it again whenever the app comes back to the foreground, so a change made in the system settings shows
up at once.

Ask when someone reaches for the feature, never at first launch.

## Add another permission

Camera, photos, location and the rest need
[react-native-permissions](https://github.com/zoontek/react-native-permissions). Add only the
permissions your app uses.

1. Install it with an exact version, check it against the [version matrix](version-matrix.md), and add
   its row there:

   ```bash
   pnpm add react-native-permissions@<version>
   ```

2. Set it up natively for each permission, as its README describes: `setup_permissions` in
   `ios/Podfile`, the usage string in `ios/<App>/Info.plist` (for example `NSCameraUsageDescription`),
   and the `<uses-permission>` line in `android/app/src/main/AndroidManifest.xml`. Mark each edit with a
   `[bareship]` comment and add a row to [native-changes.md](native-changes.md). Then run `pnpm pods`.

3. Add the kind to `PermissionKind` in `src/shared/ports/index.ts`:

   ```ts
   export type PermissionKind = 'notifications' | 'camera';
   ```

4. Give it a handler in `src/shared/services/services.ts`. Keep the library in `src/shared/adapters`:
   app code reaches it only through the port.

   ```ts
   // src/shared/adapters/native-permissions.ts
   import { check, PERMISSIONS, request, RESULTS, type Permission } from 'react-native-permissions';
   import { Platform } from 'react-native';

   import type { PermissionHandler } from './permissions';

   const toStatus = (result: string) =>
     result === RESULTS.GRANTED || result === RESULTS.LIMITED
       ? 'granted'
       : result === RESULTS.DENIED
         ? 'not-determined' // the OS can still prompt
         : 'denied'; // BLOCKED or UNAVAILABLE

   export function nativePermission(ios: Permission, android: Permission): PermissionHandler {
     const permission = Platform.OS === 'ios' ? ios : android;
     return {
       check: async () => toStatus(await check(permission)),
       request: async () => toStatus(await request(permission)),
     };
   }
   ```

   ```ts
   // in createDefaultServices()
   permissions: createPermissions({
     notifications: { … },
     camera: nativePermission(PERMISSIONS.IOS.CAMERA, PERMISSIONS.ANDROID.CAMERA),
   }),
   ```

5. Give it its words in `src/entities/permissions/PermissionSheet.tsx` (`COPY`), with an icon from
   `@/shared/ui/icons` and the strings under `permissions` in `en.json` and `hi.json`. TypeScript fails
   until every kind has its copy.

Say plainly what the app does with the permission and when, in a sentence or two. On iOS, the usage string
in `Info.plist` shows in the system prompt too, so keep the two consistent.

## Tests

Swap in a fake with `setServices({ permissions })`. In tests the bottom sheet renders its content without
being opened, so you can press the sheet's buttons directly. `src/entities/permissions/use-permission.test.tsx`
shows the pattern.
