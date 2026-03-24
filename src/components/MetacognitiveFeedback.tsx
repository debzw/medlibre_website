import { useState } from 'react';
import { BookX, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/hooks/useQuestionHistory';
import { DASHBOARD_COLORS } from '@/components/dashboard/DashboardColors';

interface ConfidenceOption {
  value: ConfidenceLevel;
  label: string;
  sublabel: string;
  color: string;
}

const StackedCardsIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* Back card */}
    <rect x="9" y="5" width="9" height="13" rx="1.5" transform="rotate(35 13.5 11.5)" fill="#1c1c1e" />
    {/* Middle card */}
    <rect x="7" y="4" width="9" height="13" rx="1.5" transform="rotate(5 11.5 10.5)" fill="#1c1c1e" />
    {/* Front card */}
    <rect x="5" y="4" width="9" height="13" rx="1.5" transform="rotate(-20 9.5 10.5)" fill="#1c1c1e" />
  </svg>
);

const OPTIONS: ConfidenceOption[] = [
  {
    value: 0,
    label: 'Apagão',
    sublabel: 'Não recordei',
    color: DASHBOARD_COLORS.critical, // #D13934
  },
  {
    value: 1,
    label: 'Muito difícil',
    sublabel: 'Quase não recordei',
    color: DASHBOARD_COLORS.warning, // #F58B2B
  },
  {
    value: 2,
    label: 'Com esforço',
    sublabel: 'Precisei pensar',
    color: DASHBOARD_COLORS.gold, // #EDB92E
  },
  {
    value: 3,
    label: 'Bom',
    sublabel: 'Recordei bem',
    color: DASHBOARD_COLORS.info, // #2DC0E0
  },
  {
    value: 4,
    label: 'Instantâneo',
    sublabel: 'Sem dificuldade',
    color: DASHBOARD_COLORS.good, // #38BE58
  },
];

interface MetacognitiveFeedbackProps {
  onFeedback?: (confidence: ConfidenceLevel) => Promise<void>;
  isLoggedIn?: boolean;
}

export function MetacognitiveFeedback({ onFeedback, isLoggedIn = false }: MetacognitiveFeedbackProps) {
  const [selected, setSelected] = useState<ConfidenceLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<number | string | null>(null);

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
    <div className="w-full relative flex justify-center items-center">
      {/* Apple-style Floating Dock Container - exactly h-11 to match Buttons */}
      <div className="bg-[#1c1c1e]/65 backdrop-blur-[24px] border border-white/10 rounded-full h-11 p-1 px-1.5 sm:px-2 flex items-center shadow-2xl mx-auto w-max gap-1 sm:gap-2 transition-all duration-300 relative z-50">
        
        {/* Left Side: Feedback Icons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {OPTIONS.map(({ value, label, color }) => {
            const isSelected = selected === value;
            const isDimmed = selected !== null && !isSelected;

            return (
              <div key={value} className="relative" onPointerEnter={() => setHoveredValue(value)} onPointerLeave={() => setHoveredValue(null)}>
                <button
                  onClick={() => handleSelect(value)}
                  disabled={selected !== null || isSubmitting}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:bg-white/10 active:bg-white/15 active:scale-95 shrink-0",
                    isDimmed && "opacity-40",
                    isSelected && "opacity-100"
                  )}
                >
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full shadow-sm transition-transform duration-300",
                      isSelected ? "scale-[1.4]" : "scale-100"
                    )}
                    style={{
                      backgroundColor: color,
                      borderColor: color,
                      borderWidth: '1px'
                    }}
                  />
                </button>
                {/* Apple-style Tooltip */}
                <div className={cn(
                  "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-all duration-200 z-[100] flex flex-col items-center bg-[#2c2c2e] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl pointer-events-none",
                  hoveredValue === value ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-1"
                )}>
                  <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap" style={{ color: color }}>
                    {label}
                  </span>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#2c2c2e] border-r border-b border-white/10 rotate-45"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-5 sm:h-6 bg-white/10 rounded-full mx-0.5 sm:mx-1 shrink-0"></div>

        {/* Right Side: Tools (Icons) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Caderno de Erros */}
          <div className="relative" onPointerEnter={() => setHoveredValue('caderno')} onPointerLeave={() => setHoveredValue(null)}>
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all duration-200 focus:outline-none shrink-0">
              <BookX className="w-4 h-4 stroke-[1.5px]" />
            </button>
            <div className={cn(
              "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-all duration-200 z-[100] flex flex-col items-center bg-[#2c2c2e] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl pointer-events-none",
              hoveredValue === 'caderno' ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-1"
            )}>
              <span className="text-white text-[11px] font-medium whitespace-nowrap">Caderno de erros</span>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#2c2c2e] border-r border-b border-white/10 rotate-45"></div>
            </div>
          </div>

          {/* Flashcards */}
          <div className="relative" onPointerEnter={() => setHoveredValue('flashcards')} onPointerLeave={() => setHoveredValue(null)}>
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all duration-200 focus:outline-none shrink-0">
              <StackedCardsIcon className="w-4 h-4" />
            </button>
            <div className={cn(
              "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-all duration-200 z-[100] flex flex-col items-center bg-[#2c2c2e] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl pointer-events-none",
              hoveredValue === 'flashcards' ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-1"
            )}>
              <span className="text-white text-[11px] font-medium whitespace-nowrap">Flashcards</span>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#2c2c2e] border-r border-b border-white/10 rotate-45"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation message - Absolutely positioned to not change flex row container height */}
      {selected !== null && (
        <div className="absolute top-full mt-2 flex items-center gap-1.5 animate-fade-in z-40">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
            {isLoggedIn
              ? 'Avaliação registada. FSRS optimizado.'
              : 'Faça login para activar o FSRS.'}
          </p>
        </div>
      )}
    </div>
  );
}
