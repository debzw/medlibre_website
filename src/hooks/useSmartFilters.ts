import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fuzzyMatch, normalize, extractAcronyms, KNOWN_ACRONYMS } from '@/lib/searchUtils';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export type Combination = [string, number, string, string, string, number]; // [banca, ano, especialidade, grande_area, tema, q_count]

export interface MetadataSummary {
    combinations: Combination[];
    stats: {
        total_questions: number;
        unique_bancas: number;
        unique_areas: number;
    };
}

export const useSmartFilters = () => {
    const [selectedBanca, setSelectedBanca] = useState<string | null>(null);
    const [selectedAno, setSelectedAno] = useState<number | null>(null);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [selectedEspecialidade, setSelectedEspecialidade] = useState<string | null>(null);
    const [selectedTema, setSelectedTema] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 150);

    const { data, isLoading } = useQuery({
        queryKey: ['question-metadata-summary'],
        queryFn: async () => {
            const { data, error } = await (supabase.rpc as any)('get_question_metadata_summary');
            if (error) throw error;
            return data as MetadataSummary;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });

    const combinations = data?.combinations || [];

    // Helper to calculate match score for sorting
    const getMatchScore = (text: string, queryParts: string[]) => {
        if (!text || queryParts.length === 0) return 0;
        const lowerText = normalize(text);
        const normalizedQueryParts = queryParts.map(p => normalize(p));

        let score = 0;
        const fullQuery = normalizedQueryParts.join(' ');

        // Exact match is top priority
        if (lowerText === fullQuery) return 100;

        // Starts with full query
        if (lowerText.startsWith(fullQuery)) return 90;

        // Contain full query
        if (lowerText.includes(fullQuery)) score += 40;

        // Word-based scoring (Simple substring matches)
        const words = lowerText.split(/[\s-]+/);
        for (const part of normalizedQueryParts) {
            for (const word of words) {
                if (word === part) score += 30;
                else if (word.startsWith(part)) score += 20;
                else if (part.length >= 3 && word.includes(part)) score += 10;
            }
        }

        return score;
    };

    // Helper to check if a combination matches the search query
    const matchesSearch = (combination: Combination, query: string) => {
        if (!query) return true;
        const normalizedQuery = normalize(query.trim());
        if (!normalizedQuery) return true;

        const [banca, _, especialidade, area, tema] = combination;
        const queryParts = normalizedQuery.split(/\s+/).filter(p => p.length > 0);

        // Simple Substring matching for any field
        return queryParts.every(part => {
            const normalizedText = normalize(`${banca} ${especialidade} ${area} ${tema}`);
            return normalizedText.includes(part);
        });
    };

    // Logic to calculate "Alive" options based on current selections AND search query
    // Includes scoring to prioritize relevant matches
    const aliveOptions = useMemo(() => {
        const queryParts = debouncedSearchQuery.toLowerCase().trim().split(/\s+/).filter(p => p.length > 0);

        // Maps store { count, score }
        const bancas = new Map<string, { count: number; score: number }>();
        const anos = new Map<number, { count: number; score: number }>();
        const areas = new Map<string, { count: number; score: number }>();
        const especialidades = new Map<string, { count: number; score: number }>();
        const temas = new Map<string, { count: number; score: number }>();

        const hasQuery = debouncedSearchQuery.length > 0;

        // Cache for scores to avoid redundant fuzzy matching
        const scoreCache = new Map<string, number>();

        combinations.forEach((combo) => {
            const [banca, ano, especialidade, area, tema, count] = combo;

            // Global Filter Check
            if (!matchesSearch(combo, debouncedSearchQuery)) return;

            // Cross-Filter Checks
            const matchesBanca = !selectedBanca || banca === selectedBanca;
            const matchesAno = !selectedAno || ano === selectedAno;
            const matchesArea = !selectedArea || area === selectedArea;
            const matchesEspecialidade = !selectedEspecialidade || especialidade === selectedEspecialidade;
            const matchesTema = !selectedTema || tema === selectedTema;

            // Helper to update map with score tracking and caching
            const updateMap = (map: Map<any, any>, key: any, textForScore: string | null) => {
                const current = map.get(key) || { count: 0, score: 0 };

                let itemScore = 0;
                if (textForScore) {
                    const cached = scoreCache.get(textForScore);
                    if (cached !== undefined) {
                        itemScore = cached;
                    } else {
                        itemScore = getMatchScore(textForScore, queryParts);
                        scoreCache.set(textForScore, itemScore);
                    }
                }

                map.set(key, {
                    count: current.count + count,
                    score: Math.max(current.score, itemScore)
                });
            };

            if (matchesAno && matchesArea && matchesEspecialidade && matchesTema) {
                updateMap(bancas, banca, banca);
            }
            if (matchesBanca && matchesArea && matchesEspecialidade && matchesTema) {
                updateMap(anos, ano, ano.toString());
            }
            if (matchesBanca && matchesAno && matchesEspecialidade && matchesTema) {
                updateMap(areas, area, area);
            }
            if (matchesBanca && matchesAno && matchesArea && matchesTema) {
                updateMap(especialidades, especialidade, especialidade);
            }
            if (matchesBanca && matchesAno && matchesArea && matchesEspecialidade) {
                updateMap(temas, tema, tema);
            }
        });

        // Sorter: High relevance first, then high count
        const relevanceSorter = (a: [any, { count: number, score: number }], b: [any, { count: number, score: number }]) => {
            if (b[1].score !== a[1].score) return b[1].score - a[1].score;
            return b[1].count - a[1].count;
        };

        const formatOutput = (map: Map<any, { count: number, score: number }>) =>
            // Returning [key, count, score]
            // If searching, only return items with some match score to avoid category contamination
            Array.from(map.entries())
                .filter(([_, val]) => !hasQuery || val.score > 0)
                .sort(relevanceSorter)
                .map(([key, val]) => [key, val.count, val.score] as [any, number, number]);

        return {
            bancas: formatOutput(bancas),
            // Anos usually better sorted numerically descending
            anos: Array.from(anos.entries()).sort((a, b) => b[0] - a[0]).map(([k, v]) => [k, v.count, 0] as [number, number, number]),
            areas: formatOutput(areas),
            especialidades: formatOutput(especialidades),
            temas: formatOutput(temas),
        };
    }, [combinations, selectedBanca, selectedAno, selectedArea, selectedEspecialidade, selectedTema, debouncedSearchQuery]);

    const totalFilteredQuestions = useMemo(() => {
        return combinations.reduce((acc, combo) => {
            const [b, a, e, ar, t, count] = combo;
            if (
                matchesSearch(combo, debouncedSearchQuery) &&
                (!selectedBanca || b === selectedBanca) &&
                (!selectedAno || a === selectedAno) &&
                (!selectedArea || ar === selectedArea) &&
                (!selectedEspecialidade || e === selectedEspecialidade) &&
                (!selectedTema || t === selectedTema)
            ) {
                return acc + count;
            }
            return acc;
        }, 0);
    }, [combinations, selectedBanca, selectedAno, selectedArea, selectedEspecialidade, selectedTema, debouncedSearchQuery]);

    const reset = () => {
        setSelectedBanca(null);
        setSelectedAno(null);
        setSelectedArea(null);
        setSelectedEspecialidade(null);
        setSelectedTema(null);
        setSearchQuery('');
    };

    const searchableTerms = useMemo(() => {
        const terms = new Set<string>();
        combinations.forEach(([banca, _, especialidade, area, tema]) => {
            if (banca) terms.add(banca);
            if (especialidade) terms.add(especialidade);
            if (area) terms.add(area);
            if (tema) terms.add(tema);
        });
        return Array.from(terms).sort();
    }, [combinations]);

    return {
        isLoading,
        aliveOptions,
        searchableTerms,
        selectedBanca,
        setSelectedBanca,
        selectedAno,
        setSelectedAno,
        selectedArea,
        setSelectedArea,
        selectedEspecialidade,
        setSelectedEspecialidade,
        selectedTema,
        setSelectedTema,
        totalFilteredQuestions,
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        stats: data?.stats,
        reset,
    };
};
