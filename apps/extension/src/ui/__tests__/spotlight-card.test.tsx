import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SpotlightCard } from '../components/reactbits/spotlight-card';

afterEach(cleanup);

// space-y-* and divide-y style direct children, so the card must not wrap or add element children.
it('keeps content as direct children so spacing and divider utilities apply, also while the spotlight shows', () => {
  render(
    <SpotlightCard data-testid="card" className="divide-y divide-line">
      <p>First</p>
      <p>Second</p>
    </SpotlightCard>,
  );
  const card = screen.getByTestId('card');
  expect(screen.getByText('First').parentElement).toBe(card);
  expect(card.children).toHaveLength(2);

  fireEvent.mouseMove(card, { clientX: 10, clientY: 10 });
  expect(card.children).toHaveLength(2);
  expect(card.style.backgroundImage).toContain('radial-gradient');

  fireEvent.mouseLeave(card);
  expect(card.style.backgroundImage).toBe('');
});
