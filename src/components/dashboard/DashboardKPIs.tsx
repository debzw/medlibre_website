'use client';

import { motion } from 'framer-motion';

interface DashboardKPIsProps {
    accuracy: number;
    totalTimeSeconds: number;
    timePerQuestionSeconds: number;
    totalQuestions: number;
    correctQuestions: number;
    onAccuracyClick?: () => void;
    accuracyActive?: boolean;
}

export function DashboardKPIs({
    accuracy,
    totalTimeSeconds,
    timePerQuestionSeconds,
    totalQuestions,
    correctQuestions,
    onAccuracyClick,
    accuracyActive,
}: DashboardKPIsProps) {

    const formatTime = (seconds: number) => {
        if (seconds === 0) return '0h00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h === 0) return `${m}m`;
        return `${h}h${m.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col md:flex-row justify-between w-full mx-auto gap-4 md:gap-8 mb-8 mt-2 text-left px-2">
            {/* Accuracy */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                onClick={onAccuracyClick}
                className={`flex flex-col items-start justify-center p-4 rounded-xl transition-all ${onAccuracyClick ? 'cursor-pointer hover:bg-muted/30 dark:hover:bg-muted/10' : ''} ${accuracyActive ? 'ring-1 ring-primary/40 bg-primary/5 dark:bg-primary/10' : ''}`}
            >
                <h3 className="text-sm font-semibold text-foreground/70 mb-1">Acurácia</h3>
                <div className="text-5xl font-black tracking-tighter text-foreground mb-1">
                    {Math.round(accuracy)}%
                </div>
                <p className="text-xs text-muted-foreground font-medium">De taxa de acerto</p>
            </motion.div>

            {/* Time */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="flex flex-col items-start justify-center p-4 border-t md:border-t-0 border-border/10"
            >
                <h3 className="text-sm font-semibold text-foreground/70 mb-1">Tempo total</h3>
                <div className="text-5xl font-black tracking-tighter text-foreground mb-1">
                    {formatTime(totalTimeSeconds)}
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                    Cerca de {Math.round(timePerQuestionSeconds)}s por questão
                </p>
            </motion.div>

            {/* Volume */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex flex-col items-start justify-center p-4 border-t md:border-t-0 border-border/10"
            >
                <h3 className="text-sm font-semibold text-foreground/70 mb-1 leading-tight">
                    Questões totais
                </h3>
                <div className="text-5xl font-black tracking-tighter text-foreground mb-1">
                    {totalQuestions}
                </div>
                <p className="text-xs text-muted-foreground font-medium">{correctQuestions} corretas</p>
            </motion.div>
        </div>
    );
}
