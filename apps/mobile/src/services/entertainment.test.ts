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

function respondWith(body: unknown, status = 200) {
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
        calls.push(url);
        return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
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

it('reports an HTTP failure, with the OMDb message when there is one and the status otherwise', async () => {
    const service = await serviceWithKey('test-key');
    respondWith({ Response: 'False', Error: 'Request limit reached!' }, 401);
    await assert.rejects(service.searchMovies('Alien'), /Request limit reached!/);
    respondWith({ message: 'Service unavailable' }, 503);
    await assert.rejects(service.searchMovies('Alien'), /HTTP 503/);
    respondWith({ Search: [{ imdbID: 'tt1', Title: 'Alien', Year: '1979', Poster: 'N/A' }] }, 500);
    await assert.rejects(service.searchMovies('Alien'), /HTTP 500/);
});

it('reports HTTP and network failures from every search instead of returning no matches', async () => {
    const service = await serviceWithKey('test-key');
    const searches = [
        service.searchMovies, service.searchTV, service.searchAnime, service.searchManga, service.searchBooks,
    ];
    for (const search of searches) {
        respondWith({ message: 'Service unavailable' }, 503);
        await assert.rejects(search('Alien'), /HTTP 503/);
        globalThis.fetch = (async () => { throw new TypeError('network down'); }) as typeof fetch;
        await assert.rejects(search('Alien'), /network down/);
    }
});
