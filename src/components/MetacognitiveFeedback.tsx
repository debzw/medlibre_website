import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/hooks/useQuestionHistory';
import { DASHBOARD_COLORS } from '@/components/dashboard/DashboardColors';

interface ConfidenceOption {
  value: ConfidenceLevel;
  label: string;
  sublabel: string;
  color: string;
}

const OPTIONS: ConfidenceOption[] = [
  {
    value: 0,
    label: 'Apagão',
    sublabel: 'Não recordei',
    color: DASHBOARD_COLORS.critical,
  },
  {
    value: 1,
    label: 'Muito difícil',
    sublabel: 'Quase não recordei',
    color: DASHBOARD_COLORS.warning,
  },
  {
    value: 2,
    label: 'Com esforço',
    sublabel: 'Precisei pensar',
    color: DASHBOARD_COLORS.gold,
  },
  {
    value: 3,
    label: 'Bom',
    sublabel: 'Recordei bem',
    color: DASHBOARD_COLORS.info,
  },
  {
    value: 4,
    label: 'Instantâneo',
    sublabel: 'Sem dificuldade',
    color: DASHBOARD_COLORS.good,
  },
];

interface MetacognitiveFeedbackProps {
  onFeedback?: (confidence: ConfidenceLevel) => Promise<void>;
  isLoggedIn?: boolean;
}

export function MetacognitiveFeedback({ onFeedback, isLoggedIn = false }: MetacognitiveFeedbackProps) {
  const [selected, setSelected] = useState<ConfidenceLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (confidence: ConfidenceLevel) => {
    if (selected !== null || isSubmitting) return;
    setSelected(confidence);
    setIsSubmitting(true);
    try {
      await onFeedback?.(confidence);
    } catch {
      // Feedback é não-crítico, não reverter selecção em caso de erro
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Como foi o esforço de recordar?
        </span>
      </div>

      {/* 5 confidence buttons — wrap on mobile, single row on sm+ */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        {OPTIONS.map(({ value, label, sublabel, color }) => {
          const isSelected = selected === value;
          const isDimmed = selected !== null && !isSelected;

          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={selected !== null || isSubmitting}
              style={{
                borderColor: isSelected ? color : color + '40',
                backgroundColor: isSelected ? color : color + '10',
                color: isSelected ? '#FFFFFF' : color,
              }}
              className={cn(
                'flex-1 min-w-[72px] flex flex-col items-center justify-center gap-1 px-2 py-3',
                'rounded-xl border font-medium text-xs',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                !isSelected && cn(
                  'shadow-sm',
                  isDimmed
                    ? 'opacity-40 cursor-default'
                    : 'cursor-pointer hover:bg-opacity-20 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                ),
                isSelected && 'shadow-lg'
              )}
            >
              <span className="font-semibold leading-tight text-center">{label}</span>
              <span className="text-[10px] opacity-70 leading-tight text-center">{sublabel}</span>
            </button>
          );
        })}
      </div>

      {/* Confirmation message */}
      {selected !== null && (
        <div className="flex items-center gap-2 pt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            {isLoggedIn
              ? 'Avaliação registada. O algoritmo FSRS irá optimizar a sua próxima revisão.'
              : 'Faça login para activar o FSRS e guardar o seu progresso de revisões.'}
          </p>
        </div>
      )}
    </div>
  );
}
