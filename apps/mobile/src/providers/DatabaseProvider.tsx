// ============================================
// Hubris - Database Provider
// ============================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDatabase } from '../db/database';

interface DatabaseContextValue {
    isReady: boolean;
    error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
    isReady: false,
    error: null,
});

export function useDatabase() {
    return useContext(DatabaseContext);
}

interface DatabaseProviderProps {
    children: React.ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function init() {
            try {
                await initializeDatabase();
                setIsReady(true);
            } catch (err) {
                console.error('Failed to initialize database:', err);
                setError(err as Error);
            }
        }
        init();
    }, []);

    return (
        <DatabaseContext.Provider value={{ isReady, error }}>
            {children}
        </DatabaseContext.Provider>
    );
}
