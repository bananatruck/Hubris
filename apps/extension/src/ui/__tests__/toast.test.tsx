import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from '../components/21st/toast';

describe('Toast live region', () => {
  it('keeps one mounted status region so screen readers announce the message when it appears', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast toast={null} onDismiss={onDismiss} />);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');

    rerender(<Toast toast={{ id: 'log-1', message: 'Leetcode logged', onUndo: vi.fn() }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toContain('Leetcode logged');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });
});
