import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPerformanceColor } from '@/components/dashboard/DashboardColors';
import { ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'accuracy' | 'total' | 'totalTime';
type SortDir = 'asc' | 'desc';

interface AreaStatsTableProps {
  statsByField: Record<string, { correct: number; total: number; avgTime: number }>;
  isLoading?: boolean;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ChevronUp className="ml-1 h-3 w-3 opacity-20 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp className="ml-1 h-3 w-3 opacity-80 inline" />
    : <ChevronDown className="ml-1 h-3 w-3 opacity-80 inline" />;
}

export function AreaStatsTable({ statsByField, isLoading }: AreaStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAll, setShowAll] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (isLoading) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-semibold text-foreground/80 py-2.5 px-6 uppercase tracking-wider text-xs">Especialidade</TableHead>
              <TableHead className="py-2.5 px-6 text-right text-xs uppercase tracking-wider">Acurácia</TableHead>
              <TableHead className="py-2.5 px-6 text-right text-xs uppercase tracking-wider">Questões Totais</TableHead>
              <TableHead className="py-2.5 px-6 text-right text-xs uppercase tracking-wider">Tempo Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i} className="border-border/50">
                {Array.from({ length: 4 }, (_, j) => (
                  <TableCell key={j} className="py-2.5 px-6">
                    <div className="h-4 rounded bg-muted/40 animate-pulse" style={{ width: j === 0 ? '60%' : '40%' }} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (Object.keys(statsByField).length === 0) {
    return null;
  }

  const allFields = Object.entries(statsByField).map(([name, data]) => {
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const totalTime = Math.round(data.avgTime * data.total);
    return { name, accuracy, total: data.total, totalTime };
  });

  const hiddenCount = allFields.filter(f => f.total === 0).length;

  const fields = allFields
    .filter(f => showAll || f.total > 0)
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      return (a[sortKey] - b[sortKey]) * mul;
    });

  const thClass = "font-semibold text-foreground/80 py-2.5 px-6 uppercase tracking-wider text-xs text-right cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="font-semibold text-foreground/80 py-2.5 px-6 uppercase tracking-wider text-xs">Especialidade</TableHead>
            <TableHead className={thClass} onClick={() => handleSort('accuracy')}>
              Acurácia<SortIcon column="accuracy" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={thClass} onClick={() => handleSort('total')}>
              Questões Totais<SortIcon column="total" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={thClass} onClick={() => handleSort('totalTime')}>
              Tempo Total<SortIcon column="totalTime" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.name} className="border-border/50 hover:bg-muted/30 transition-colors">
              <TableCell className="py-2.5 px-6 font-medium text-foreground">{field.name}</TableCell>
              <TableCell
                className="py-2.5 px-6 text-right font-bold"
                style={{ color: field.total > 0 ? getPerformanceColor(field.accuracy) : undefined }}
              >
                {field.total > 0 ? `${field.accuracy}%` : '—'}
              </TableCell>
              <TableCell className="py-2.5 px-6 text-right text-muted-foreground">
                {field.total > 0 ? field.total : '—'}
              </TableCell>
              <TableCell className="py-2.5 px-6 text-right text-muted-foreground">
                {field.total > 0 ? formatTime(field.totalTime) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer toggle */}
      {(hiddenCount > 0 || showAll) && (
        <div className="border-t border-border/50 px-6 py-2.5 flex justify-center">
          {!showAll ? (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + {hiddenCount} especialidade{hiddenCount !== 1 ? 's' : ''} não estudada{hiddenCount !== 1 ? 's' : ''}
            </button>
          ) : (
            <button
              onClick={() => setShowAll(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mostrar só estudadas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
