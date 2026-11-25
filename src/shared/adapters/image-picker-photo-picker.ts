import { launchCamera, launchImageLibrary, type PhotoQuality } from 'react-native-image-picker';

import type { Logger, PhotoPicker } from '@/shared/ports';

/** 2048 px on the long side keeps a phone photo sharp on screen at a few hundred KB. */
const DEFAULT_MAX_SIZE = 2048;
const DEFAULT_QUALITY = 0.8;

/**
 * Photos through react-native-image-picker. The library opens the system picker (PHPicker on iOS, the
 * Photo Picker on Android), which needs no permission. The camera opens the system camera app: Android
 * needs no permission for it, iOS asks with NSCameraUsageDescription. The library resizes and
 * re-encodes natively, so no full-size image ever reaches JS.
 */
export function createImagePickerPhotoPicker(logger: Logger): PhotoPicker {
  return {
    async pick(source, options = {}) {
      const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
      const common = {
        mediaType: 'photo' as const,
        maxWidth: maxSize,
        maxHeight: maxSize,
        quality: (options.quality ?? DEFAULT_QUALITY) as PhotoQuality,
        // HEIC from iPhones becomes JPEG, which every backend and browser can show.
        assetRepresentationMode: 'compatible' as const,
      };
      const response =
        source === 'camera'
          ? await launchCamera({ ...common, saveToPhotos: false })
          : await launchImageLibrary({ ...common, selectionLimit: 1 });

      if (response.didCancel) return null;
      if (response.errorCode) {
        logger.warn('Photo picker failed', {
          source,
          code: response.errorCode,
          message: response.errorMessage ?? '',
        });
        throw new Error(response.errorMessage ?? response.errorCode);
      }
      const asset = response.assets?.[0];
      if (!asset?.uri) return null;
      return {
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        size: asset.fileSize ?? 0,
        mimeType: asset.type ?? 'image/jpeg',
        fileName: asset.fileName ?? 'photo.jpg',
      };
    },
  };
}
