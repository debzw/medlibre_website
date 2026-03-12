import { useState, useRef, useEffect } from 'react';
import { Search, X, FilterX, FileDown, History } from 'lucide-react';
import { Command as CommandPrimitive } from "cmdk";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getHighlightedParts, normalize, levenshteinDistance } from '@/lib/searchUtils';
import { useSearchHistory } from '@/hooks/useSearchHistory';

interface ThinkingSearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    hasFilters?: boolean;
    onReset?: () => void;
    aliveOptions: {
        bancas: [string, number, number][];
        areas: [string, number, number][];
        especialidades: [string, number, number][];
        temas: [string, number, number][];
    };
    onIntentDetected: (type: 'banca' | 'area' | 'especialidade' | 'tema', value: string) => void;
    decsTermSuggestions?: string[];
    className?: string;
    isPremium?: boolean;
    totalFilteredQuestions?: number;
    onExport?: () => void;
}

export const ThinkingSearchBar = ({
    searchQuery,
    setSearchQuery,
    hasFilters,
    onReset,
    aliveOptions,
    onIntentDetected,
    decsTermSuggestions = [],
    className,
    isPremium,
    totalFilteredQuestions = 0,
    onExport
}: ThinkingSearchBarProps) => {
    const { history, addToHistory, clearHistory, removeFromHistory } = useSearchHistory();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate Best Match across all categories
    const allOptions = [
        ...aliveOptions.bancas.map(i => ({ type: 'banca' as const, value: i[0], count: i[1], score: i[2] })),
        ...aliveOptions.areas.map(i => ({ type: 'area' as const, value: i[0], count: i[1], score: i[2] })),
        ...aliveOptions.especialidades.map(i => ({ type: 'especialidade' as const, value: i[0], count: i[1], score: i[2] })),
        ...aliveOptions.temas.map(i => ({ type: 'tema' as const, value: i[0], count: i[1], score: i[2] })),
    ];

    // Sort by score descending
    const bestMatches = allOptions
        .filter(opt => opt.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.count - a.count;
        })
        .slice(0, 3); // Top 3 absolute best matches

    // Unified suggestions: bestMatches + DeCS terms not already covered
    const decsNotInBest = decsTermSuggestions.filter(
        term => !bestMatches.some(m => normalize(m.value) === normalize(term))
    );
    const unifiedSuggestions = [
        ...bestMatches.map(m => ({
            key: `match-${m.type}-${m.value}`,
            text: m.value,
            onSelect: () => { addToHistory(m.value); onIntentDetected(m.type, m.value); setSearchQuery(''); }
        })),
        ...decsNotInBest.map(term => ({
            key: `decs-${term}`,
            text: term,
            onSelect: () => { setSearchQuery(term); setIsOpen(false); }
        })),
    ].slice(0, 5);

    // Suggestions for typos
    const getSuggestions = (query: string, options: typeof allOptions): string[] => {
        if (query.length < 3) return [];
        const normQuery = normalize(query);

        return Array.from(new Set(options.map(opt => opt.value)))
            .map(val => ({
                val,
                dist: levenshteinDistance(normalize(val), normQuery)
            }))
            .filter(({ dist }) => dist > 0 && dist <= 2)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3)
            .map(d => d.val);
    };

    const suggestedTerms = getSuggestions(searchQuery, allOptions);

    const Highlight = ({ text, query }: { text: string; query: string }) => {
        const parts = getHighlightedParts(text, query);
        return (
            <span>
                {parts.map((part, i) => (
                    part.highlight ? (
                        <span key={i} className="text-primary font-bold">{part.text}</span>
                    ) : (
                        <span key={i}>{part.text}</span>
                    )
                ))}
            </span>
        );
    };

    return (
        <div ref={containerRef} className={cn("relative group w-full max-w-2xl mx-auto z-50 flex items-center gap-3", className)}>
            <Command shouldFilter={false} className="flex-1 rounded-2xl border-2 border-muted bg-background/50 backdrop-blur-sm focus-within:border-primary/50 transition-all shadow-lg focus-within:shadow-primary/5 shadow-black/5 overflow-visible">
                <div className="flex items-center px-4" cmdk-input-wrapper="">
                    <Search className="mr-3 h-6 w-6 shrink-0 text-muted-foreground opacity-50" />
                    <CommandPrimitive.Input
                        placeholder="O que vamos estudar hoje?"
                        value={searchQuery}
                        onValueChange={(val) => {
                            setSearchQuery(val);
                            if (val) setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        className="flex h-16 w-full rounded-md bg-transparent py-4 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSearchQuery('')}
                            className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                {isOpen && (searchQuery || history.length > 0) && (
                    <div className="absolute top-[calc(100%+12px)] left-0 w-full z-[100] animate-in fade-in zoom-in-95 duration-200">
                        <CommandList className="w-full bg-popover rounded-xl border shadow-2xl max-h-[400px] overflow-y-auto p-2">
                            {!searchQuery && history.length > 0 && (
                                <CommandGroup
                                    heading={
                                        <div className="flex items-center justify-between w-full">
                                            <span>Buscas Recentes</span>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    clearHistory();
                                                }}
                                                className="text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                Limpar tudo
                                            </button>
                                        </div>
                                    }
                                >
                                    {history.map(term => (
                                        <CommandItem
                                            key={term}
                                            value={term}
                                            onSelect={() => {
                                                setSearchQuery(term);
                                            }}
                                            className="flex justify-between items-center py-2.5 px-4 rounded-lg group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <History className="h-4 w-4 text-muted-foreground/50 group-aria-selected:text-primary transition-colors" />
                                                <span className="text-sm">{term}</span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    removeFromHistory(term);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-all text-muted-foreground"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {searchQuery && (
                                <CommandEmpty className="py-8 px-4 text-center">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                Nenhum resultado direto para "<span className="font-semibold text-foreground">{searchQuery}</span>"
                                            </p>
                                            <p className="text-xs text-muted-foreground/60">
                                                Experimente ajustar os filtros ou revisar a ortografia.
                                            </p>
                                        </div>

                                        {suggestedTerms.length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Você quis dizer:</p>
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    {suggestedTerms.map(term => (
                                                        <Button
                                                            key={term}
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSearchQuery(term)}
                                                            className="h-8 rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-xs transition-all active:scale-95"
                                                        >
                                                            {term}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSearchQuery('')}
                                                className="text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="mr-2 h-3 w-3" /> Limpar busca
                                            </Button>
                                            {searchQuery.length > 2 && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="text-xs font-semibold"
                                                    onClick={() => {
                                                        const params = new URLSearchParams();
                                                        params.set('search', searchQuery);
                                                        window.location.href = `/app?${params.toString()}`;
                                                    }}
                                                >
                                                    <Search className="mr-2 h-3 w-3" /> Buscar em todas as questões
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CommandEmpty>
                            )}

                            {unifiedSuggestions.length > 0 && searchQuery.length > 0 && (
                                <CommandGroup>
                                    {unifiedSuggestions.map(item => (
                                        <CommandItem
                                            key={item.key}
                                            value={item.key}
                                            onSelect={item.onSelect}
                                            className="py-2.5 px-4 rounded-lg aria-selected:bg-primary/10"
                                        >
                                            <Highlight text={item.text} query={searchQuery} />
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                        </CommandList>
                    </div>
                )}
            </Command>
            <div className="flex items-center gap-2">
                {hasFilters && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onReset}
                        className="h-16 w-16 shrink-0 rounded-2xl border-2 border-muted bg-background/50 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all shadow-lg active:scale-95 animate-in fade-in zoom-in slide-in-from-right-4 duration-300"
                        title="Limpar todos os filtros"
                    >
                        <FilterX className="h-6 w-6" />
                    </Button>
                )}

                {hasFilters && totalFilteredQuestions > 0 && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onExport}
                        className="h-16 w-16 shrink-0 rounded-2xl border-2 border-muted bg-background/50 backdrop-blur-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-lg active:scale-95 animate-in fade-in zoom-in slide-in-from-right-4 duration-300 delay-75"
                        title="Exportar como PDF"
                    >
                        <FileDown className="h-6 w-6" />
                    </Button>
                )}
            </div>
        </div>
    );
};
