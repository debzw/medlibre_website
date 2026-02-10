import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardWidgetProps {
    title?: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: ReactNode;
    className?: string;
    loading?: boolean;
    noPadding?: boolean;
    colSpan?: 1 | 2 | 3 | 4;
    rowSpan?: 1 | 2;
    onClick?: () => void;
}

export function DashboardWidget({
    title,
    icon: Icon,
    children,
    className,
    loading = false,
    noPadding = false,
    colSpan = 1,
    rowSpan = 1,
    onClick
}: DashboardWidgetProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
                "group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-500",
                "bg-card/20 border-border/50 backdrop-blur-sm",
                "hover:border-primary/30 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]",
                "dark:hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]",
                colSpan === 2 && "col-span-1 md:col-span-2",
                colSpan === 3 && "col-span-1 md:col-span-3",
                colSpan === 4 && "col-span-1 md:col-span-4",
                rowSpan === 2 && "row-span-2",
                onClick && "cursor-pointer active:scale-[0.99]",
                className
            )}
            onClick={onClick}
        >
            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            {/* Header */}
            {(title || Icon) && (
                <div className={cn(
                    "flex items-center gap-4 transition-colors relative z-10",
                    noPadding ? "px-6 pt-5 pb-1" : "px-6 pt-6 pb-2"
                )}>
                    {Icon && (
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary-rgb),0.1)] group-hover:bg-primary/10 group-hover:scale-105 transition-all duration-500">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    {title && (
                        <h3 className="font-medium tracking-wider text-muted-foreground uppercase text-xs opacity-80 group-hover:opacity-100 transition-opacity">
                            {title}
                        </h3>
                    )}
                </div>
            )}

            {/* Body */}
            <div className={cn(
                "flex-1 relative z-10",
                noPadding ? "p-0" : "px-6 pb-6 pt-2"
            )}>{children}</div>

            {/* Subtle glow effects */}
            <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary/5 blur-[100px] transition-opacity duration-1000 group-hover:opacity-100 opacity-40 dark:opacity-60" />
            <div className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-primary/10 blur-[80px] transition-opacity duration-1000 group-hover:opacity-100 opacity-20 dark:opacity-40" />
        </motion.div>
    );
}
