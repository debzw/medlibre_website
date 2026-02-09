import { useState, useEffect } from 'react';

const STORAGE_KEY = 'medlibre_search_history';
const MAX_HISTORY = 5;

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setHistory(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse search history', e);
            }
        }
    }, []);

    const addToHistory = (query: string) => {
        if (!query || query.trim().length < 2) return;

        const newHistory = [
            query.trim(),
            ...history.filter(h => h !== query.trim())
        ].slice(0, MAX_HISTORY);

        setHistory(newHistory);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const removeFromHistory = (query: string) => {
        const newHistory = history.filter(h => h !== query);
        setHistory(newHistory);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    };

    return {
        history,
        addToHistory,
        clearHistory,
        removeFromHistory
    };
}
