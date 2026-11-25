import { onlineManager } from '@tanstack/react-query';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { http as mock } from 'msw';
import { Pressable, Text } from 'react-native';

import { server } from '@/mocks/node';
import type { FileStore, Permissions, PhotoPicker } from '@/shared/ports';
import { setServices } from '@/shared/services/services';
import { signInDemoUser } from '@/test/app';
import { renderWithProviders } from '@/test/render';

import { useCreatePost } from '../api';
import { FeedScreen } from './FeedScreen';
import { NewPostScreen } from './NewPostScreen';

const PHOTO = {
  uri: 'file:///tmp/picked.jpg',
  width: 2048,
  height: 1536,
  size: 400_000,
  mimeType: 'image/jpeg',
  fileName: 'picked.jpg',
};

function fakeMedia() {
  const photos = { pick: jest.fn(async () => PHOTO) } satisfies PhotoPicker;
  const files = {
    keep: jest.fn(async () => 'kept-1.jpg'),
    uriOf: (id: string) => `file:///documents/kept-files/${id}`,
    exists: jest.fn(async () => true),
    remove: jest.fn(async () => {}),
  } satisfies FileStore;
  setServices({ photos, files });
  return { photos, files };
}

/** The feed, plus a button that posts like the compose screen does. */
function FeedWithPost({ body, photo = true }: { body: string; photo?: boolean }) {
  const createPost = useCreatePost();
  return (
    <>
      <Pressable
        role="button"
        aria-label="Share"
        onPress={() =>
          createPost.mutate({
            postId: 'p_local',
            body,
            photo: photo
              ? { fileId: 'kept-1.jpg', mimeType: 'image/jpeg', fileName: 'picked.jpg' }
              : null,
          })
        }
      >
        <Text>{'Share'}</Text>
      </Pressable>
      <FeedScreen />
    </>
  );
}

const card = () => screen.getByTestId('post-card-p_local');

describe('NewPostScreen', () => {
  beforeEach(async () => {
    await signInDemoUser();
  });

  it('enables Post once there is text, and shows a picked photo with a way to remove it', async () => {
    const { photos } = fakeMedia();
    const user = userEvent.setup();
    await renderWithProviders(<NewPostScreen />);

    const submit = screen.getByTestId('new-post-submit');
    expect(submit).toBeDisabled();
    await user.type(screen.getByTestId('new-post-body'), 'Sunset from the ridge');
    expect(submit).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Photos' }));
    expect(photos.pick).toHaveBeenCalledWith('library', { maxSize: 2048 });
    const remove = await screen.findByRole('button', { name: 'Remove photo' });
    await user.press(remove);
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeOnTheScreen();
  });

  it('explains the camera first, then opens it once access is granted', async () => {
    const { photos } = fakeMedia();
    let camera: 'not-determined' | 'granted' = 'not-determined';
    const permissions = {
      check: jest.fn(async () => camera),
      request: jest.fn(async () => {
        camera = 'granted';
        return camera;
      }),
      openSettings: jest.fn(async () => {}),
    } satisfies Permissions;
    setServices({ permissions });
    const user = userEvent.setup();
    await renderWithProviders(<NewPostScreen />);

    await user.press(await screen.findByRole('button', { name: 'Camera' }));
    expect(screen.getByText('Use your camera')).toBeOnTheScreen();
    expect(photos.pick).not.toHaveBeenCalled();

    // The sheet's Continue (the test bottom sheet renders every sheet's content).
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    expect(permissions.request).toHaveBeenCalledWith('camera');
    await waitFor(() => expect(photos.pick).toHaveBeenCalledWith('camera', { maxSize: 2048 }));
  });

  it('hides the camera on a device without one', async () => {
    fakeMedia();
    setServices({
      permissions: {
        check: async () => 'unavailable',
        request: async () => 'unavailable',
        openSettings: async () => {},
      },
    });
    await renderWithProviders(<NewPostScreen />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Camera' })).not.toBeOnTheScreen(),
    );
    expect(screen.getByRole('button', { name: 'Photos' })).toBeOnTheScreen();
  });
});

describe('useCreatePost', () => {
  beforeEach(async () => {
    await signInDemoUser();
  });

  it('shows the post at once while its photo uploads, then the saved post', async () => {
    const { files } = fakeMedia();
    // Hold the upload until the in-progress card is checked; returning nothing falls through.
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    server.use(mock.post('*/uploads', () => held, { once: true }));
    const user = userEvent.setup();
    await renderWithProviders(<FeedWithPost body="Sunset from the ridge" />);
    await screen.findByTestId('post-card-p_1');

    await user.press(screen.getByRole('button', { name: 'Share' }));
    expect(within(card()).getByText('Sunset from the ridge')).toBeOnTheScreen();
    expect(within(card()).getByTestId('local-post-status')).toBeOnTheScreen();
    expect(within(card()).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    release();

    // Saved: the like button replaces the upload status, and the kept photo is deleted.
    await waitFor(() =>
      expect(within(card()).getByRole('button', { name: 'Like' })).toBeOnTheScreen(),
    );
    expect(within(card()).queryByTestId('local-post-status')).not.toBeOnTheScreen();
    expect(files.remove).toHaveBeenCalledWith('kept-1.jpg');
  });

  it('waits while offline, then uploads when the phone reconnects', async () => {
    fakeMedia();
    const user = userEvent.setup();
    await renderWithProviders(<FeedWithPost body="Written on the train" />);
    await screen.findByTestId('post-card-p_1');
    await act(async () => onlineManager.setOnline(false));

    await user.press(screen.getByRole('button', { name: 'Share' }));
    expect(await within(card()).findByText('Waiting to upload')).toBeOnTheScreen();

    await act(async () => onlineManager.setOnline(true));
    await waitFor(() =>
      expect(within(card()).getByRole('button', { name: 'Like' })).toBeOnTheScreen(),
    );
  });

  it('keeps a refused post as failed, with Try again and Remove', async () => {
    const { files } = fakeMedia();
    const user = userEvent.setup();
    await renderWithProviders(<FeedWithPost body="This one #fail" />);
    await screen.findByTestId('post-card-p_1');

    await user.press(screen.getByRole('button', { name: 'Share' }));
    expect(await within(card()).findByText("Couldn't upload this.")).toBeOnTheScreen();
    expect(within(card()).getByRole('button', { name: 'Try again' })).toBeOnTheScreen();

    await user.press(within(card()).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByTestId('post-card-p_local')).not.toBeOnTheScreen();
    expect(files.remove).toHaveBeenCalledWith('kept-1.jpg');
  });
});
