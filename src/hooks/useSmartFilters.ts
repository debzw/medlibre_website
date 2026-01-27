import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

    // Helper to check if a combination matches the search query
    const matchesSearch = (combination: Combination, query: string) => {
        if (!query) return true;
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) return true;

        const [banca, _, especialidade, area, tema] = combination;
        const searchableText = `${banca} ${especialidade} ${area} ${tema}`.toLowerCase();

        // Simple "all terms must exist" logic
        const terms = lowerQuery.split(/\s+/);
        return terms.every(term => searchableText.includes(term));
    };

    // Logic to calculate "Alive" options based on current selections AND search query
    const aliveOptions = useMemo(() => {
        const bancas = new Map<string, number>();
        const anos = new Map<number, number>();
        const areas = new Map<string, number>();
        const especialidades = new Map<string, number>();
        const temas = new Map<string, number>();

        combinations.forEach((combo) => {
            const [banca, ano, especialidade, area, tema, count] = combo;

            // Check global search match first
            if (!matchesSearch(combo, searchQuery)) return;

            // Check if this combination matches all *other* filters
            const matchesBanca = !selectedBanca || banca === selectedBanca;
            const matchesAno = !selectedAno || ano === selectedAno;
            const matchesArea = !selectedArea || area === selectedArea;
            const matchesEspecialidade = !selectedEspecialidade || especialidade === selectedEspecialidade;
            const matchesTema = !selectedTema || tema === selectedTema;

            // Update counters for each field if the *rest* of the filters match
            if (matchesAno && matchesArea && matchesEspecialidade && matchesTema) {
                bancas.set(banca, (bancas.get(banca) || 0) + count);
            }
            if (matchesBanca && matchesArea && matchesEspecialidade && matchesTema) {
                anos.set(ano, (anos.get(ano) || 0) + count);
            }
            if (matchesBanca && matchesAno && matchesEspecialidade && matchesTema) {
                areas.set(area, (areas.get(area) || 0) + count);
            }
            if (matchesBanca && matchesAno && matchesArea && matchesTema) {
                especialidades.set(especialidade, (especialidades.get(especialidade) || 0) + count);
            }
            if (matchesBanca && matchesAno && matchesArea && matchesEspecialidade) {
                temas.set(tema, (temas.get(tema) || 0) + count);
            }
        });

        return {
            bancas: Array.from(bancas.entries()).sort((a, b) => b[1] - a[1]),
            anos: Array.from(anos.entries()).sort((a, b) => b[0] - a[0]),
            areas: Array.from(areas.entries()).sort((a, b) => b[1] - a[1]),
            especialidades: Array.from(especialidades.entries()).sort((a, b) => b[1] - a[1]),
            temas: Array.from(temas.entries()).sort((a, b) => b[1] - a[1]),
        };
    }, [combinations, selectedBanca, selectedAno, selectedArea, selectedEspecialidade, selectedTema, searchQuery]);

    const totalFilteredQuestions = useMemo(() => {
        return combinations.reduce((acc, combo) => {
            const [b, a, e, ar, t, count] = combo;
            if (
                matchesSearch(combo, searchQuery) &&
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
    }, [combinations, selectedBanca, selectedAno, selectedArea, selectedEspecialidade, selectedTema, searchQuery]);

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
        stats: data?.stats,
        reset,
    };
};
