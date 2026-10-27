import { render, screen } from '@testing-library/react-native';

import { Text } from './Text';

// iOS aligns text with no textAlign by its own script, so English text stayed on the left in a
// right-to-left layout. 'start' follows the layout direction on iOS and Android (ADR 0017).
const NAME = 'Demo User';

describe('Text alignment', () => {
  it('aligns to the start of the layout by default', async () => {
    await render(<Text>{NAME}</Text>);
    expect(screen.getByText(NAME)).toHaveStyle({ textAlign: 'start' });
  });

  it('takes an explicit alignment', async () => {
    await render(<Text align="center">{NAME}</Text>);
    expect(screen.getByText(NAME)).toHaveStyle({ textAlign: 'center' });
  });
});
