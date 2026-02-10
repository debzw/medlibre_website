import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  options,
  selectedBanca,
  selectedAno,
  selectedCampo,
  hideAnswered,
  onBancaChange,
  onAnoChange,
  onCampoChange,
  onHideAnsweredChange,
  loading,
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Banca */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Banca</label>
              <Select
                value={selectedBanca}
                onValueChange={onBancaChange}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas as bancas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as bancas</SelectItem>
                  {options.bancas.map((banca) => (
                    <SelectItem key={banca} value={banca}>
                      {banca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ano */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ano</label>
              <Select
                value={selectedAno.toString()}
                onValueChange={(v) => onAnoChange(parseInt(v))}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos os anos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos os anos</SelectItem>
                  {options.anos.map((ano) => (
                    <SelectItem key={ano} value={ano.toString()}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo Médico */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Especialidade</label>
              <Select
                value={selectedCampo}
                onValueChange={onCampoChange}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas as especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as especialidades</SelectItem>
                  {options.campos.map((campo) => (
                    <SelectItem key={campo} value={campo}>
                      {campo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Hide answered toggle */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
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
