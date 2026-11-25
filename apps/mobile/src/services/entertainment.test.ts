// Runs with Node's built-in test runner: pnpm --filter @hubris/mobile test
import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';

const realFetch = globalThis.fetch;
let loads = 0;
afterEach(() => { globalThis.fetch = realFetch; });

async function serviceWithKey(key: string | undefined) {
    if (key === undefined) delete process.env.EXPO_PUBLIC_OMDB_API_KEY;
    else process.env.EXPO_PUBLIC_OMDB_API_KEY = key;
    // The key is read when the module loads, so load a fresh copy for each case.
    const module = await import(`./entertainment.ts?load=${loads++}`);
    return module.entertainmentService as typeof import('./entertainment').entertainmentService;
}

function respondWith(body: unknown) {
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
        calls.push(url);
        return { json: async () => body } as Response;
    }) as typeof fetch;
    return calls;
}

it('reports a missing OMDb key instead of returning no matches', async () => {
    for (const key of [undefined, '', '   ']) {
        const service = await serviceWithKey(key);
        const calls = respondWith({ Response: 'False', Error: 'No API key provided.' });
        await assert.rejects(service.searchMovies('Alien'), /OMDb API key is not set/);
        assert.deepEqual(calls, []);
    }
});

it('reports an OMDb error such as a rejected key', async () => {
    const service = await serviceWithKey('test-key');
    respondWith({ Response: 'False', Error: 'Invalid API key!' });
    await assert.rejects(service.searchMovies('Alien'), /Invalid API key!/);
});

it('returns no matches when OMDb finds no movie', async () => {
    const service = await serviceWithKey('test-key');
    respondWith({ Response: 'False', Error: 'Movie not found!' });
    assert.deepEqual(await service.searchMovies('zzzz'), []);
});
