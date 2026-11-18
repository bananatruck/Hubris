import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../storage/validation';
import { errorMessage } from '../lib/errors';

describe('errorMessage', () => {
  it.each([new ValidationError('Enter a name.'), new Error('Storage is full.')])('preserves readable Error messages', (cause) => {
    expect(errorMessage(cause)).toBe(cause.message);
  });

  it.each([undefined, null, 'failed', 42, {}])('uses the save fallback for unknown rejection values', (cause) => {
    expect(errorMessage(cause)).toBe('Could not save that change. Try again.');
  });
});

it('falls back to the generic message when an error has no message', () => {
  expect(errorMessage(new Error(''))).toBe('Could not save that change. Try again.');
});
