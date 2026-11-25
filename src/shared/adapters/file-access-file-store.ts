import { Dirs, FileSystem } from 'react-native-file-access';

import { createId } from '@/shared/api/id';
import type { FileStore } from '@/shared/ports';

const FOLDER = 'kept-files';

const toPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));
const pathOf = (id: string) => `${Dirs.DocumentDir}/${FOLDER}/${id}`;

/**
 * Kept files live in the app's documents folder, which the system never clears, under an id (the
 * file name). The folder's absolute path can change between app updates on iOS, so ids are resolved
 * against `Dirs.DocumentDir` each time.
 */
export function createFileAccessFileStore(): FileStore {
  let ready: Promise<void> | undefined;
  const ensureFolder = () => {
    ready ??= (async () => {
      const folder = `${Dirs.DocumentDir}/${FOLDER}`;
      if (!(await FileSystem.exists(folder))) await FileSystem.mkdir(folder);
    })();
    return ready;
  };

  return {
    async keep(uri) {
      await ensureFolder();
      const extension = /\.(\w{2,5})$/.exec(uri)?.[1]?.toLowerCase() ?? 'jpg';
      const id = `${createId()}.${extension}`;
      await FileSystem.cp(toPath(uri), pathOf(id));
      return id;
    },
    uriOf: id => `file://${pathOf(id)}`,
    exists: id => FileSystem.exists(pathOf(id)),
    async remove(id) {
      if (await FileSystem.exists(pathOf(id))) await FileSystem.unlink(pathOf(id));
    },
  };
}
