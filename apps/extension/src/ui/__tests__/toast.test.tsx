import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast, type ToastData } from '../components/21st/toast';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Toast live region', () => {
  it('keeps one mounted status region so screen readers announce the message when it appears', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast toasts={[]} onDismiss={onDismiss} />);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');

    rerender(<Toast toasts={[{ id: 'log-1', message: 'Leetcode logged', undoLabel: 'Undo Leetcode', onUndo: vi.fn() }]} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(region.textContent).toBe('Leetcode logged');
    expect(screen.getByRole('button', { name: 'Undo Leetcode' })).toBeTruthy();
  });
});

describe('Toast announcements', () => {
  const alpha = (id: string): ToastData => ({ id, message: 'Alpha logged', undoLabel: 'Undo Alpha', onUndo: vi.fn() });

  it('announces a repeated message again as a new update', () => {
    const { rerender } = render(<Toast toasts={[alpha('a1')]} onDismiss={vi.fn()} />);
    const region = screen.getByRole('status');
    const first = region.firstElementChild;
    expect(region.textContent).toBe('Alpha logged');

    rerender(<Toast toasts={[alpha('a1'), alpha('a2')]} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('Alpha logged');
    expect(region.firstElementChild).not.toBe(first);
  });

  it('does not announce an older message again when the newest toast is dismissed', () => {
    const beta: ToastData = { id: 'b', message: 'Beta logged' };
    const { rerender } = render(<Toast toasts={[alpha('a1'), beta]} onDismiss={vi.fn()} />);
    const region = screen.getByRole('status');
    const announcement = region.firstElementChild;
    expect(region.textContent).toBe('Beta logged');

    rerender(<Toast toasts={[alpha('a1')]} onDismiss={vi.fn()} />);
    expect(region.firstElementChild).toBe(announcement);
    expect(region.textContent).toBe('Beta logged');

    rerender(<Toast toasts={[]} onDismiss={vi.fn()} />);
    expect(region.textContent).toBe('');
  });
});

it('styles error notifications red and never offers Undo', () => {
  const { container } = render(<Toast toasts={[{ id: 'error', tone: 'error', message: 'Storage is full.' }]} onDismiss={vi.fn()} />);
  expect(container.querySelector('.border-red-500\\/60')).toBeTruthy();
  expect(container.querySelector('.text-red-200')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
});

it('gives two log toasts independent Undo actions', () => {
  const undoA = vi.fn();
  const undoB = vi.fn();
  const initialToasts: ToastData[] = [
    { id: 'a', message: 'Alpha logged', undoLabel: 'Undo Alpha', onUndo: undoA },
    { id: 'b', message: 'Beta logged', undoLabel: 'Undo Beta', onUndo: undoB },
  ];

  function Harness() {
    const [toasts, setToasts] = useState(initialToasts);
    return <Toast toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Undo Beta' }));
  expect(undoB).toHaveBeenCalledOnce();
  expect(undoA).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Undo Alpha' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Undo Alpha' }));
  expect(undoA).toHaveBeenCalledOnce();
});

it.each(['pointer', 'focus'])('pauses the remaining timeout during %s interaction', (kind) => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<Toast toasts={[{ id: '1', message: 'Logged', undoLabel: 'Undo Activity', onUndo: vi.fn() }]} onDismiss={onDismiss} />);
  const undo = screen.getByRole('button', { name: 'Undo Activity' });
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
  expect(onDismiss).toHaveBeenCalledWith('1');
});

it('waits for both hover and focus to leave and keeps focus moves within the toast paused', () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<Toast toasts={[{ id: '1', message: 'Logged', undoLabel: 'Undo Activity', onUndo: vi.fn() }]} onDismiss={onDismiss} />);
  const undo = screen.getByRole('button', { name: 'Undo Activity' });
  const dismiss = screen.getByRole('button', { name: 'Dismiss Logged' });
  fireEvent.pointerEnter(undo.parentElement ?? undo);
  fireEvent.focus(undo);
  fireEvent.pointerLeave(undo.parentElement ?? undo);
  fireEvent.blur(undo, { relatedTarget: dismiss });
  fireEvent.focus(dismiss, { relatedTarget: undo });
  act(() => vi.advanceTimersByTime(10000));
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.blur(dismiss, { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(6000));
  expect(onDismiss).toHaveBeenCalledWith('1');
});

it('expires an older toast on its own timer while a newer toast stays', () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const first = { id: 'a', message: 'Alpha logged' };
  const second = { id: 'b', message: 'Beta logged' };
  const { rerender } = render(<Toast toasts={[first]} onDismiss={onDismiss} />);
  act(() => vi.advanceTimersByTime(2000));
  rerender(<Toast toasts={[first, second]} onDismiss={onDismiss} />);

  act(() => vi.advanceTimersByTime(4000));

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith('a');
  expect(onDismiss).not.toHaveBeenCalledWith('b');
});

describe('Toast focus on dismissal', () => {
  function Harness({ initial, fallback }: { initial: ToastData[]; fallback?: () => HTMLElement | null }) {
    const [toasts, setToasts] = useState(initial);
    return <>
      <button type="button">Outside</button>
      <div tabIndex={-1} data-testid="fallback">Panel</div>
      <Toast
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
        fallbackFocus={fallback}
      />
    </>;
  }
  const toasts = (): ToastData[] => [
    { id: 'a', message: 'Alpha logged', undoLabel: 'Undo Alpha', onUndo: vi.fn() },
    { id: 'b', message: 'Beta logged', undoLabel: 'Undo Beta', onUndo: vi.fn() },
  ];

  it('moves focus to the toast that takes the place of a dismissed one, or the one before it', () => {
    render(<Harness initial={[...toasts(), { id: 'c', message: 'Gamma logged', undoLabel: 'Undo Gamma', onUndo: vi.fn() }]} />);
    const dismissBeta = screen.getByRole('button', { name: 'Dismiss Beta logged' });
    dismissBeta.focus();
    fireEvent.click(dismissBeta);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo Gamma' }));

    const undoGamma = screen.getByRole('button', { name: 'Undo Gamma' });
    fireEvent.click(undoGamma);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo Alpha' }));
  });

  it('moves focus to the fallback target when the last toast goes', () => {
    render(<Harness initial={[toasts()[0]]} fallback={() => screen.getByTestId('fallback')} />);
    const undo = screen.getByRole('button', { name: 'Undo Alpha' });
    undo.focus();
    fireEvent.click(undo);
    expect(document.activeElement).toBe(screen.getByTestId('fallback'));
  });

  it('leaves focus alone when it was outside the dismissed toast', () => {
    render(<Harness initial={toasts()} fallback={() => screen.getByTestId('fallback')} />);
    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Beta logged' }));
    expect(document.activeElement).toBe(outside);
  });
});
