'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { getHeatmapColor, DASHBOARD_COLORS } from './DashboardColors';
import { motion, useReducedMotion } from 'framer-motion';
import { usePerformanceHeatmap } from '@/hooks/usePerformanceHeatmap';
import { usePerformanceHeatmapByArea } from '@/hooks/usePerformanceHeatmapByArea';

const cols = 20;
const rows = 7;
const TOTAL_DAYS = cols * rows; // 140

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Returns YYYY-MM-DD in BRT — matches stat_date stored by the trigger
function getBRTDate(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

interface PerformanceHeatmapProps {
    mode?: 'binary' | 'accuracy';
    areaFilter?: string;
}

export function PerformanceHeatmap({ mode = 'binary', areaFilter }: PerformanceHeatmapProps) {
    const global = usePerformanceHeatmap(TOTAL_DAYS);
    const byArea = usePerformanceHeatmapByArea(areaFilter ?? '', TOTAL_DAYS);
    const { data, isLoading } = areaFilter ? byArea : global;
    const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
    const prefersReducedMotion = useReducedMotion();
    const scrollRef = useRef<HTMLDivElement>(null);

    // On mobile, always show the most recent columns (scroll to right end after load)
    useEffect(() => {
        if (!isLoading && scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [isLoading]);

    // O(1) lookup: YYYY-MM-DD → accuracy
    const accuracyMap = useMemo(() => {
        const map = new Map<string, number>();
        if (data) {
            for (const entry of data) {
                map.set(entry.date, entry.accuracy);
            }
        }
        return map;
    }, [data]);

    // Build 140-cell grid anchored to today's real day-of-week in BRT.
    // grid-auto-flow:column fills rows first, so row = i%7 must match the actual weekday.
    // Strategy: grid starts on the Monday of the week (cols-1) weeks ago.
    // Cells after today (future days in the current week) are rendered as invisible placeholders.
    const cells = useMemo(() => {
        // Today in BRT as a plain date (avoids UTC conversion in getDay())
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const [ty, tm, td] = todayStr.split('-').map(Number);
        const jsDow = new Date(ty, tm - 1, td).getDay(); // 0=Sun … 6=Sat
        const dayIndex = (jsDow + 6) % 7; // 0=Mon … 6=Sun

        // Cell i=0 is (cols-1)*7 + dayIndex days before today (= last Monday of 19 weeks ago)
        const startDaysAgo = (cols - 1) * rows + dayIndex;

        return Array.from({ length: TOTAL_DAYS }, (_, i) => {
            const daysAgo = startDaysAgo - i;
            if (daysAgo < 0) {
                // Future day in the current week — invisible placeholder
                return { isoDate: '', accuracy: 0, isEmpty: true, isFuture: true, dateLabel: '', fullDate: '' };
            }
            const isoDate = getBRTDate(daysAgo);
            const accuracy = accuracyMap.has(isoDate) ? accuracyMap.get(isoDate)! : null;
            const [year, month, day] = isoDate.split('-');
            return {
                isoDate,
                accuracy: accuracy ?? 0,
                isEmpty: accuracy === null,
                isFuture: false,
                dateLabel: `${day}/${month}`,
                fullDate: `${day}/${month}/${year}`,
            };
        });
    }, [accuracyMap]);

    return (
        <div className="w-full select-none">
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs font-body font-semibold shadow-md -translate-x-1/2 -translate-y-full animate-in fade-in-0 zoom-in-95"
                    style={{ left: tooltip.x, top: tooltip.y - 8 }}
                >
                    {tooltip.label}
                </div>
            )}
            <div className="flex flex-row">
                {/* Day-of-week labels — in-flow, left of grid */}
                <div className="flex flex-col gap-[2px] pr-2 pt-4 shrink-0">
                    {DAY_LABELS.map(label => (
                        <div
                            key={label}
                            className="h-[28px] sm:h-[32px] flex items-center justify-end text-[9px] sm:text-[10px] font-mono opacity-40 leading-none whitespace-nowrap"
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {/* Heatmap grid — scrollable, flows column-by-column so rows = days of week */}
                {/* max-w caps to 8 cols on mobile (8×30px); sm+ shows all 20 */}
                <div ref={scrollRef} className="overflow-x-auto scrollbar-none max-w-[240px] sm:max-w-none">
                    <div
                        className="grid gap-[2px] pt-4 pb-0"
                        style={{
                            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                            gridAutoFlow: 'column',
                            gridAutoColumns: 'minmax(0, 1fr)',
                            width: 'max-content',
                        }}
                    >
                        {isLoading
                            ? Array.from({ length: TOTAL_DAYS }, (_, i) => (
                                <div
                                    key={i}
                                    className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] rounded-md sm:rounded-lg animate-pulse"
                                    style={{ backgroundColor: 'rgba(128,128,128,0.2)' }}
                                />
                            ))
                            : cells.map((cell, i) => {
                                if (cell.isFuture) {
                                    return <div key={i} className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px]" />;
                                }
                                const isBinary = mode === 'binary';
                                const emptyColor = DASHBOARD_COLORS.neutral + '4D';
                                const bgColor = isBinary
                                    ? (cell.isEmpty ? emptyColor : '#93C5FD')
                                    : (cell.isEmpty ? emptyColor : getHeatmapColor(cell.accuracy));
                                const col = Math.floor(i / rows);

                                const cellLabel = !isBinary && !cell.isEmpty ? `${cell.dateLabel} · ${cell.accuracy}%` : cell.dateLabel;
                                return (
                                    <motion.div
                                        key={`${i}-${mode}`}
                                        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                                        animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                                        transition={prefersReducedMotion ? {} : { delay: col * 0.02 }}
                                        data-date={cell.isoDate}
                                        data-accuracy={cell.isEmpty ? undefined : cell.accuracy}
                                        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, label: cellLabel })}
                                        onMouseLeave={() => setTooltip(null)}
                                        onTouchStart={(e) => {
                                            e.preventDefault();
                                            const touch = e.touches[0];
                                            setTooltip({ x: touch.clientX, y: touch.clientY, label: cellLabel });
                                        }}
                                        onTouchEnd={() => setTimeout(() => setTooltip(null), 1200)}
                                        className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-heading transition-transform hover:scale-110 z-10 hover:z-20 cursor-default shadow-sm"
                                        style={{
                                            backgroundColor: bgColor,
                                            color: cell.isEmpty ? 'currentColor' : 'rgba(0,0,0,0.6)',
                                            opacity: cell.isEmpty ? 0.3 : 1,
                                        }}
                                    >
                                    </motion.div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}
