import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { PermissionKind, PermissionStatus } from '@/shared/ports';
import { services } from '@/shared/services/services';
import type { SheetRef } from '@/shared/ui/primitives/Sheet';

import type { PermissionSheetProps } from './PermissionSheet';

/**
 * A runtime permission, asked with an explanation first. `ask()` opens the sheet: it says why the app
 * needs the permission before the system prompt, or how to turn it back on once the OS won't prompt
 * again. Render `<PermissionSheet {...permission.sheet} />` once on the screen.
 *
 * The status is read again when the app returns to the foreground, because people change it in the
 * system settings.
 */
export function usePermission(kind: PermissionKind) {
  const [status, setStatus] = useState<PermissionStatus | 'unknown'>('unknown');
  const ref = useRef<SheetRef>(null);

  useEffect(() => {
    const read = () => {
      services()
        .permissions.check(kind)
        .then(setStatus)
        .catch(() => setStatus('not-determined'));
    };
    read();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') read();
    });
    return () => subscription.remove();
  }, [kind]);

  const ask = () => {
    if (status !== 'granted') ref.current?.present();
  };

  const onContinue = async () => {
    ref.current?.dismiss();
    try {
      if (status === 'denied') {
        await services().permissions.openSettings();
        return;
      }
      setStatus(await services().permissions.request(kind));
    } catch (error) {
      services().logger.warn('Permission request failed', { kind, error: String(error) });
    }
  };

  const sheet: PermissionSheetProps = {
    ref,
    kind,
    blocked: status === 'denied',
    onContinue,
    onCancel: () => ref.current?.dismiss(),
  };

  return { status, ask, sheet };
}
