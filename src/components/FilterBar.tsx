import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FilterOptions } from '@/types/database';
import { Filter, EyeOff, ChevronDown } from 'lucide-react';

interface FilterBarProps {
  options: FilterOptions;
  selectedBanca: string;
  selectedAno: number;
  selectedCampo: string;
  hideAnswered: boolean;
  onBancaChange: (value: string) => void;
  onAnoChange: (value: number) => void;
  onCampoChange: (value: string) => void;
  onHideAnsweredChange: (value: boolean) => void;
  loading?: boolean;
}

export function FilterBar({
  hideAnswered,
  onHideAnsweredChange,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="card-elevated p-3 sm:p-4 animate-fade-in transition-all duration-300">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Filtros</h2>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'
          }`}
      >
        <div className="overflow-hidden">
          <div className="flex items-center gap-3 pt-2">
            <EyeOff className="w-4 h-4 text-muted-foreground" />
            <Switch
              id="hide-answered"
              checked={hideAnswered}
              onCheckedChange={onHideAnsweredChange}
            />
            <Label htmlFor="hide-answered" className="text-sm cursor-pointer">
              Ocultar questões já respondidas
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
