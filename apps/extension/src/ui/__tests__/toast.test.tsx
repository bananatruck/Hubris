import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../components/21st/toast';

afterEach(cleanup);

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

it('styles error notifications red and never offers Undo', () => {
  const { container } = render(<Toast toast={{ id: 'error', tone: 'error', message: 'Storage is full.', onUndo: vi.fn() }} onDismiss={vi.fn()} />);
  expect(container.querySelector('.border-red-500\\/60')).toBeTruthy();
  expect(container.querySelector('.text-red-200')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
});
