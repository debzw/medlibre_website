import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AliveFilterProps {
    label: string;
    options: [string | number, number][]; // [value, count]
    selected: string | number | null;
    onSelect: (value: any) => void;
    className?: string;
}

export const AliveFilter = ({ label, options, selected, onSelect, className }: AliveFilterProps) => {
    const selectedLabel = selected || label;
    const totalOptions = options.length;

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "justify-between h-12 px-4 rounded-xl border-2 transition-all",
                            selected ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-700 dark:text-yellow-400" : "border-muted hover:border-primary/20"
                        )}
                    >
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px] p-1 rounded-xl shadow-xl border-muted/50 overflow-hidden">
                    <ScrollArea className={cn("overflow-y-auto", options.length > 7 ? "h-72" : "h-auto")}>
                        <div className="p-1 space-y-0.5">
                            {options.map(([value]) => (
                                <DropdownMenuItem
                                    key={String(value)}
                                    onSelect={() => onSelect(value === selected ? null : value)}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors",
                                        selected === value ? "bg-yellow-400/20 text-yellow-700 dark:text-yellow-400" : "hover:bg-muted"
                                    )}
                                >
                                    <div className="flex items-center gap-2 max-w-[160px]">
                                        {selected === value && <Check className="h-4 w-4 shrink-0" />}
                                        <span className="truncate">{value}</span>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                            {totalOptions === 0 && (
                                <div className="py-8 text-center text-xs text-muted-foreground">
                                    Nenhuma opção disponível
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
