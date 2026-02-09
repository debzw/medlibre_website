import { useState, useRef, useEffect } from 'react';
import { Search, X, Check, FilterX, FileDown, History } from 'lucide-react';
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
import { Badge } from '../ui/badge';
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

    // Filter suggestions based on current input
    const topBancas = aliveOptions.bancas.filter(i => i[2] > 0 || !searchQuery).slice(0, 3);
    const topAreas = aliveOptions.areas.filter(i => i[2] > 0 || !searchQuery).slice(0, 3);
    const topEspecialidades = aliveOptions.especialidades.filter(i => i[2] > 0 || !searchQuery).slice(0, 5);
    const topTemas = aliveOptions.temas.filter(i => i[2] > 0 || !searchQuery).slice(0, 5);

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

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'banca': return '🏛️';
            case 'area': return '🎯';
            case 'especialidade': return '🏥';
            case 'tema': return '📚';
            default: return '🔍';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'banca': return 'Instituição';
            case 'area': return 'Grande Área';
            case 'especialidade': return 'Especialidade';
            case 'tema': return 'Tema';
            default: return type;
        }
    };

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

                            {bestMatches.length > 0 && searchQuery.length > 0 && (
                                <CommandGroup heading="Sugestão Principal" className="text-primary">
                                    {bestMatches.map((match) => (
                                        <CommandItem
                                            key={`${match.type}-${match.value}`}
                                            value={match.value}
                                            onSelect={() => {
                                                addToHistory(match.value);
                                                onIntentDetected(match.type, match.value);
                                                setSearchQuery('');
                                            }}
                                            className="flex justify-between items-center aria-selected:bg-primary/10 py-3 px-4 rounded-lg group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <span className="text-xl shrink-0 grayscale group-aria-selected:grayscale-0 transition-all">
                                                    {getTypeIcon(match.type)}
                                                </span>
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <div className="truncate">
                                                        <Highlight text={match.value} query={searchQuery} />
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground/70 font-medium">
                                                        {getTypeLabel(match.type)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="bg-muted/50 text-muted-foreground shrink-0 ml-2 font-mono text-[10px]">
                                                {match.count}
                                            </Badge>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {topBancas.length > 0 && (
                                <CommandGroup heading="Instituições">
                                    {topBancas.map(([banca, count]) => (
                                        <CommandItem
                                            key={banca}
                                            value={banca}
                                            onSelect={() => {
                                                onIntentDetected('banca', banca);
                                                setSearchQuery('');
                                            }}
                                            className="flex justify-between"
                                        >
                                            <Highlight text={banca} query={searchQuery} />
                                            <span className="text-xs text-muted-foreground">{count} questões</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {topAreas.length > 0 && (
                                <CommandGroup heading="Grandes Áreas">
                                    {topAreas.map(([area, count]) => (
                                        <CommandItem
                                            key={area}
                                            value={area}
                                            onSelect={() => {
                                                onIntentDetected('area', area);
                                                setSearchQuery('');
                                            }}
                                            className="flex justify-between"
                                        >
                                            <Highlight text={area} query={searchQuery} />
                                            <span className="text-xs text-muted-foreground">{count} questões</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {topEspecialidades.length > 0 && (
                                <CommandGroup heading="Especialidades">
                                    {topEspecialidades.map(([esp, count]) => (
                                        <CommandItem
                                            key={esp}
                                            value={esp}
                                            onSelect={() => {
                                                onIntentDetected('especialidade', esp);
                                                setSearchQuery('');
                                            }}
                                            className="flex justify-between"
                                        >
                                            <Highlight text={esp} query={searchQuery} />
                                            <span className="text-xs text-muted-foreground">{count} questões</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {topTemas.length > 0 && (
                                <CommandGroup heading="Temas">
                                    {topTemas.map(([tema, count]) => (
                                        <CommandItem
                                            key={tema}
                                            value={tema}
                                            onSelect={() => {
                                                onIntentDetected('tema', tema);
                                                setSearchQuery('');
                                            }}
                                            className="flex justify-between"
                                        >
                                            <Highlight text={tema} query={searchQuery} />
                                            <span className="text-xs text-muted-foreground">{count} questões</span>
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
