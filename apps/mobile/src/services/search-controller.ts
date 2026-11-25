export interface SearchState<T> {
    results: T[];
    error: string | null;
    searching: boolean;
}

export const EMPTY_SEARCH: SearchState<never> = Object.freeze({ results: [], error: null, searching: false });

/**
 * Debounced search where only the latest request owns the screen.
 * Every keystroke and every reset (a category switch or leaving the screen) cancels the pending pause
 * and disowns any running request, so a late result or error from an older query or another category
 * is dropped instead of shown.
 */
export function createSearchController<C, T>(
    search: (category: C, query: string) => Promise<T[]>,
    onChange: (state: SearchState<T>) => void,
    waitMs = 500,
) {
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let state: SearchState<T> = EMPTY_SEARCH;
    const set = (next: SearchState<T>) => {
        state = next;
        onChange(next);
    };
    const disown = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        generation += 1;
    };

    return {
        /** A keystroke: supersedes any pending or running search and searches after the pause. */
        type(category: C, query: string) {
            disown();
            if (!query.trim()) {
                set(EMPTY_SEARCH);
                return;
            }
            if (state.searching) set({ ...state, searching: false });
            const mine = generation;
            timer = setTimeout(() => {
                timer = undefined;
                set({ ...state, error: null, searching: true });
                search(category, query).then(
                    (results) => { if (mine === generation) set({ results, error: null, searching: false }); },
                    (cause: unknown) => {
                        if (mine !== generation) return;
                        set({ results: [], error: cause instanceof Error ? cause.message : 'Search failed. Try again.', searching: false });
                    },
                );
            }, waitMs);
        },
        /** A category switch: drops pending and running searches and clears what is shown. */
        reset() {
            disown();
            set(EMPTY_SEARCH);
        },
        /** Leaving the screen: drops pending and running searches without reporting state. */
        dispose() {
            disown();
        },
    };
}
