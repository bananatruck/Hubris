// Runs with Node's built-in test runner: pnpm --filter @hubris/mobile test
import assert from 'node:assert/strict';
import { afterEach, beforeEach, it, mock } from 'node:test';
import { createSearchController, type SearchState } from './search-controller.ts';

beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }); });
afterEach(() => { mock.timers.reset(); });

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

function setup() {
    const calls: { category: string; query: string; reply: ReturnType<typeof deferred<string[]>> }[] = [];
    const states: SearchState<string>[] = [];
    const controller = createSearchController<string, string>((category, query) => {
        const reply = deferred<string[]>();
        calls.push({ category, query, reply });
        return reply.promise;
    }, (state) => states.push(state), 500);
    const last = () => states.at(-1);
    return { controller, calls, last };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

it('searches once after the pause and shows the results', async () => {
    const { controller, calls, last } = setup();
    controller.type('movie', 'al');
    controller.type('movie', 'alien');
    mock.timers.tick(500);
    assert.deepEqual(calls.map((c) => c.query), ['alien']);
    assert.equal(last()?.searching, true);
    calls[0].reply.resolve(['Alien']);
    await flush();
    assert.deepEqual(last(), { results: ['Alien'], error: null, searching: false });
});

it('ignores a result and an error from the category the user left', async () => {
    const { controller, calls, last } = setup();
    controller.type('movie', 'alien');
    mock.timers.tick(500);
    controller.reset();
    calls[0].reply.reject(new Error('Movie search failed: HTTP 503'));
    await flush();
    assert.deepEqual(last(), { results: [], error: null, searching: false });
});

it('cancels a pending keystroke when the category changes', () => {
    const { controller, calls } = setup();
    controller.type('movie', 'alien');
    controller.reset();
    mock.timers.tick(1000);
    assert.equal(calls.length, 0);
});

it('ignores an older query that answers after a newer one', async () => {
    const { controller, calls, last } = setup();
    controller.type('tv', 'lost');
    mock.timers.tick(500);
    controller.type('tv', 'lost in space');
    mock.timers.tick(500);
    calls[1].reply.resolve(['Lost in Space']);
    await flush();
    calls[0].reply.resolve(['Lost']);
    await flush();
    assert.deepEqual(last(), { results: ['Lost in Space'], error: null, searching: false });
});

it('reports the error of the current search and clears it when the query empties', async () => {
    const { controller, calls, last } = setup();
    controller.type('movie', 'alien');
    mock.timers.tick(500);
    calls[0].reply.reject(new Error('Movie search failed: HTTP 503'));
    await flush();
    assert.deepEqual(last(), { results: [], error: 'Movie search failed: HTTP 503', searching: false });
    controller.type('movie', '');
    assert.deepEqual(last(), { results: [], error: null, searching: false });
});
