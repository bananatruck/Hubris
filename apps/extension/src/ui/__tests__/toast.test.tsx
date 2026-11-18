import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../components/21st/toast';

afterEach(() => { cleanup(); vi.useRealTimers(); });

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


it.each(['pointer', 'focus'])('pauses the remaining timeout during %s interaction', (kind) => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<Toast toast={{ id: '1', message: 'Logged', onUndo: vi.fn() }} onDismiss={onDismiss} />);
  const undo = screen.getByRole('button', { name: 'Undo' });
  act(() => vi.advanceTimersByTime(2000));
  if (kind === 'pointer') fireEvent.pointerEnter(undo.parentElement ?? undo);
  else fireEvent.focus(undo);
  act(() => vi.advanceTimersByTime(10000));
  expect(onDismiss).not.toHaveBeenCalled();
  if (kind === 'pointer') fireEvent.pointerLeave(undo.parentElement ?? undo);
  else fireEvent.blur(undo, { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(3999));
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onDismiss).toHaveBeenCalledOnce();
});

it('waits for both hover and focus to leave and keeps focus moves within the toast paused', () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<Toast toast={{ id: '1', message: 'Logged', onUndo: vi.fn() }} onDismiss={onDismiss} />);
  const undo = screen.getByRole('button', { name: 'Undo' });
  const dismiss = screen.getByRole('button', { name: 'Dismiss' });
  fireEvent.pointerEnter(undo.parentElement ?? undo);
  fireEvent.focus(undo);
  fireEvent.pointerLeave(undo.parentElement ?? undo);
  fireEvent.blur(undo, { relatedTarget: dismiss });
  fireEvent.focus(dismiss, { relatedTarget: undo });
  act(() => vi.advanceTimersByTime(10000));
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.blur(dismiss, { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(6000));
  expect(onDismiss).toHaveBeenCalledOnce();
});

it('dismisses by button and gives a replacement toast its full timeout', () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const { rerender } = render(<Toast toast={{ id: '1', message: 'First' }} onDismiss={onDismiss} />);
  act(() => vi.advanceTimersByTime(5000));
  rerender(<Toast toast={{ id: '2', message: 'Second' }} onDismiss={onDismiss} />);
  act(() => vi.advanceTimersByTime(5999));
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(onDismiss).toHaveBeenCalledOnce();
  rerender(<Toast toast={null} onDismiss={onDismiss} />);
  act(() => vi.advanceTimersByTime(10000));
  expect(onDismiss).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toBe('');
});
