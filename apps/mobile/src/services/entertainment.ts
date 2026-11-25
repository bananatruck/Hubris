export interface EntertainmentItem {
    id: string;
    title: string;
    type: 'movie' | 'tv' | 'anime' | 'manga' | 'book';
    imageUrl?: string;
    description?: string;
    year?: string;
    externalId: string;
}

// OMDb API (Free with key)
// Read at build time from apps/mobile/.env.local (see .env.example); Expo inlines EXPO_PUBLIC_ variables.
// The key ships inside the app bundle either way, so treat it as public and keep it rotated.
const OMDB_API_KEY = (process.env.EXPO_PUBLIC_OMDB_API_KEY ?? '').trim();
// OMDb answers a search without matches with Response 'False' and this message; any other False is a failure.
const OMDB_NO_MATCHES = 'Movie not found!';
const OMDB_BASE_URL = 'https://www.omdbapi.com';

// Jikan API (Free)
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// OpenLibrary API (Free)
const OPENLIB_BASE_URL = 'https://openlibrary.org';

/**
 * Fetches JSON for a search. A failure (network error, HTTP error status, or a body that is not JSON)
 * is thrown with a message the screen can show; only a real answer with no matches becomes an empty list.
 * fetch resolves on HTTP errors, so the status is checked here.
 */
async function fetchJson(url: string, what: string, errorDetail?: (body: any) => unknown): Promise<any> {
    const response = await fetch(url);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const detail = errorDetail?.(body);
        throw new Error(`${what} failed: ${typeof detail === 'string' ? detail : `HTTP ${response.status}`}`);
    }
    if (body === null) throw new Error(`${what} failed: the service sent a response that is not JSON.`);
    return body;
}

export const entertainmentService = {
    async searchMovies(query: string): Promise<EntertainmentItem[]> {
        if (!query) return [];
        // A configuration or service failure is reported, never shown as an empty result.
        if (!OMDB_API_KEY) {
            throw new Error('The OMDb API key is not set, so movie search is unavailable. Add EXPO_PUBLIC_OMDB_API_KEY to apps/mobile/.env.local.');
        }
        const data = await fetchJson(
            `${OMDB_BASE_URL}/?apikey=${encodeURIComponent(OMDB_API_KEY)}&s=${encodeURIComponent(query)}&type=movie`,
            'Movie search',
            (body) => body?.Error,
        );

        if (data.Response === 'False') {
            if (data.Error === OMDB_NO_MATCHES) return [];
            throw new Error(`Movie search failed: ${data.Error ?? 'OMDb returned an error.'}`);
        }

        return (data.Search || []).map((item: any) => ({
            id: `omdb-movie-${item.imdbID}`,
            title: item.Title,
            type: 'movie',
            imageUrl: item.Poster !== 'N/A' ? item.Poster : undefined,
            description: undefined, // OMDb search doesn't return plot, would need detail fetch
            year: item.Year,
            externalId: item.imdbID,
        }));
    },

    async searchTV(query: string): Promise<EntertainmentItem[]> {
        if (!query) return [];
        const data = await fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`, 'TV search');

        return (data || []).map((item: any) => ({
            id: `tvmaze-${item.show.id}`,
            title: item.show.name,
            type: 'tv',
            imageUrl: item.show.image?.medium,
            description: item.show.summary?.replace(/<[^>]*>/g, ''), // Strip HTML tags
            year: item.show.premiered ? item.show.premiered.split('-')[0] : undefined,
            externalId: item.show.id.toString(),
        }));
    },

    async searchAnime(query: string): Promise<EntertainmentItem[]> {
        if (!query) return [];
        const data = await fetchJson(`${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=10`, 'Anime search');

        return (data.data || []).map((item: any) => ({
            id: `mal-anime-${item.mal_id}`,
            title: item.title,
            type: 'anime',
            imageUrl: item.images?.jpg?.image_url,
            description: item.synopsis,
            year: item.year?.toString(),
            externalId: item.mal_id.toString(),
        }));
    },

    async searchManga(query: string): Promise<EntertainmentItem[]> {
        if (!query) return [];
        const data = await fetchJson(`${JIKAN_BASE_URL}/manga?q=${encodeURIComponent(query)}&limit=10`, 'Manga search');

        return (data.data || []).map((item: any) => ({
            id: `mal-manga-${item.mal_id}`,
            title: item.title,
            type: 'manga',
            imageUrl: item.images?.jpg?.image_url,
            description: item.synopsis,
            year: item.published?.from ? item.published.from.split('-')[0] : undefined,
            externalId: item.mal_id.toString(),
        }));
    },

    async searchBooks(query: string): Promise<EntertainmentItem[]> {
        if (!query) return [];
        const data = await fetchJson(`${OPENLIB_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=10`, 'Book search');

        return (data.docs || []).map((item: any) => ({
            id: `openlib-book-${item.key.replace('/works/', '')}`,
            title: item.title,
            type: 'book',
            imageUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : undefined,
            description: item.first_sentence?.[0],
            year: item.first_publish_year?.toString(),
            externalId: item.key,
        }));
    }
};
