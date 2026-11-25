import { Platform } from 'react-native';
import {
  check,
  PERMISSIONS,
  type PermissionStatus as Result,
  request,
  RESULTS,
} from 'react-native-permissions';

import type { PermissionStatus } from '@/shared/ports';

import type { PermissionHandler } from './permissions';

const toStatus = (result: Result): PermissionStatus => {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'not-determined'; // the OS can still prompt
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    default:
      return 'denied'; // BLOCKED: only the system settings can change it
  }
};

/**
 * The camera, through react-native-permissions on iOS (only the Camera handler is built, see
 * `setup_permissions` in ios/Podfile). Android needs none: photos are taken by the system camera app,
 * and the app doesn't declare the CAMERA permission (declaring it would make the camera app refuse
 * until it's granted).
 */
export function cameraPermission(): PermissionHandler {
  if (Platform.OS !== 'ios') {
    return { check: async () => 'granted', request: async () => 'granted' };
  }
  return {
    check: async () => toStatus(await check(PERMISSIONS.IOS.CAMERA)),
    request: async () => toStatus(await request(PERMISSIONS.IOS.CAMERA)),
  };
}
