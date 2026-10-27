import { onlineManager } from '@tanstack/react-query';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { http as mock, HttpResponse } from 'msw';

import { server } from '@/mocks/node';
import { signInDemoUser } from '@/test/app';
import { renderWithProviders } from '@/test/render';

import { FeedScreen } from './FeedScreen';

// Every post has a like button, so like-button queries are scoped to one post's card.
const post = (id: string) => screen.getByTestId(`post-card-${id}`);
const findPost = (id: string) => screen.findByTestId(`post-card-${id}`);

describe('FeedScreen', () => {
  beforeEach(async () => {
    await signInDemoUser();
  });

  it('shows skeletons, then the first page of posts mapped from the API', async () => {
    // Hold the first page until the skeleton is checked; on a fast machine the mock answers before the
    // first assertion. Returning nothing falls through to the default handler.
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    server.use(mock.get('*/posts', () => held, { once: true }));

    await renderWithProviders(<FeedScreen />);
    expect(screen.getByTestId('feed-loading')).toBeOnTheScreen();
    release();

    const first = await screen.findByTestId('post-p_1');
    // display_name (snake_case DTO) → author.name (model)
    expect(within(first).getByText('Demo User')).toBeOnTheScreen();
  });

  it('likes a post optimistically and keeps the server result', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<FeedScreen />);
    const like = within(await findPost('p_2')).getByRole('button', { name: 'Like' });
    expect(within(like).getByText('7 likes')).toBeOnTheScreen();

    await user.press(like);

    const unlike = await within(post('p_2')).findByRole('button', { name: 'Unlike' });
    expect(within(unlike).getByText('8 likes')).toBeOnTheScreen();
  });

  it('likes while offline: shows it at once as waiting, then syncs on reconnect', async () => {
    let requests = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/like')) requests += 1;
    });
    const user = userEvent.setup();
    await renderWithProviders(<FeedScreen />);
    await findPost('p_2');
    await act(async () => onlineManager.setOnline(false));

    await user.press(within(post('p_2')).getByRole('button', { name: 'Like' }));
    const unlike = within(post('p_2')).getByRole('button', { name: 'Unlike' });
    expect(within(unlike).getByText('8 likes')).toBeOnTheScreen();
    expect(await within(post('p_2')).findByText('Waiting to sync')).toBeOnTheScreen();
    expect(requests).toBe(0);

    await act(async () => onlineManager.setOnline(true));
    await waitFor(() =>
      expect(within(post('p_2')).queryByText('Waiting to sync')).not.toBeOnTheScreen(),
    );
    expect(requests).toBe(1);
    expect(
      within(within(post('p_2')).getByRole('button', { name: 'Unlike' })).getByText('8 likes'),
    ).toBeOnTheScreen();
    server.events.removeAllListeners();
  });

  it('rolls back a failed like and tells the user', async () => {
    server.use(mock.post('*/posts/:id/like', () => HttpResponse.json({}, { status: 400 })));
    const user = userEvent.setup();
    await renderWithProviders(<FeedScreen />);
    await user.press(within(await findPost('p_2')).getByRole('button', { name: 'Like' }));

    expect(await screen.findByText("Couldn't save your like. Try again.")).toBeOnTheScreen();
    const like = within(post('p_2')).getByRole('button', { name: 'Like' });
    expect(within(like).getByText('7 likes')).toBeOnTheScreen();
  });

  it('shows an error with retry when the first load fails', async () => {
    server.use(mock.get('*/posts', () => HttpResponse.json({}, { status: 404 })));
    const user = userEvent.setup();
    await renderWithProviders(<FeedScreen />);

    expect(await screen.findByText("Couldn't load the feed")).toBeOnTheScreen();
    server.resetHandlers();
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('post-p_1')).toBeOnTheScreen();
  });
});
