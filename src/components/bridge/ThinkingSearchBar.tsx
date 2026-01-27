import { Search, X, Check, FilterX, FileDown } from 'lucide-react';
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

interface ThinkingSearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    hasFilters?: boolean;
    onReset?: () => void;
    aliveOptions: {
        bancas: [string, number][];
        areas: [string, number][];
        especialidades: [string, number][];
        temas: [string, number][];
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
    // Filter suggestions based on current input
    const topBancas = aliveOptions.bancas.slice(0, 3);
    const topAreas = aliveOptions.areas.slice(0, 3);
    const topEspecialidades = aliveOptions.especialidades.slice(0, 5);
    const topTemas = aliveOptions.temas.slice(0, 5);

    return (
        <div className={cn("relative group w-full max-w-2xl mx-auto z-50 flex items-center gap-3", className)}>
            <Command className="flex-1 rounded-2xl border-2 border-muted bg-background/50 backdrop-blur-sm focus-within:border-primary/50 transition-all shadow-lg focus-within:shadow-primary/5 shadow-black/5 overflow-visible">
                <div className="flex items-center px-4" cmdk-input-wrapper="">
                    <Search className="mr-3 h-6 w-6 shrink-0 text-muted-foreground opacity-50" />
                    <CommandPrimitive.Input
                        placeholder="O que vamos estudar hoje?"
                        value={searchQuery}
                        onValueChange={setSearchQuery}
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

                {searchQuery && (
                    <div className="absolute top-[calc(100%+12px)] left-0 w-full z-[100] animate-in fade-in zoom-in-95 duration-200">
                        <CommandList className="w-full bg-popover rounded-xl border shadow-2xl max-h-[400px] overflow-y-auto p-2">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {searchQuery.length > 2 ? (
                                    <span>Pressione <span className="font-bold text-primary">Enter</span> para buscar por "{searchQuery}"</span>
                                ) : (
                                    <span>Nenhuma opção encontrada com esses termos.</span>
                                )}
                            </CommandEmpty>

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
                                            <span>{banca}</span>
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
                                            <span>{area}</span>
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
                                            <span>{esp}</span>
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
                                            <span>{tema}</span>
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
