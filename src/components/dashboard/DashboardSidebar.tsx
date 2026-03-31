'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';

interface SidebarItemProps {
    icon?: React.ElementType;
    initials?: string;
    label: string;
    active?: boolean;
    isSubItem?: boolean;
    collapsed: boolean;
    href?: string;
    comingSoon?: boolean;
}

function SidebarItem({ icon: Icon, initials, label, active, isSubItem, collapsed, href, comingSoon }: SidebarItemProps) {
    const inner = (
        <span
            className={cn(
                "w-full flex items-center transition-colors hover:bg-sidebar-accent dark:hover:bg-white/10 text-sm py-3",
                collapsed ? "justify-center px-0" : "px-6",
                active ? "bg-sidebar-accent border-l-4 border-primary text-foreground font-semibold dark:bg-white/5" : "text-muted-foreground border-l-4 border-transparent",
                isSubItem && !collapsed ? "pl-10" : ""
            )}
        >
            {collapsed && initials
                ? <span className="text-muted-foreground font-bold text-[11px] leading-none tracking-tight">{initials}</span>
                : Icon && <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-5 w-5 mr-3", active ? "text-primary" : "")} />
            }
            {!collapsed && (
                <span className="flex items-center justify-between w-full min-w-0">
                    <span className="truncate">{label}</span>
                    {comingSoon && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-foreground/8 text-muted-foreground/60 dark:bg-white/8 dark:text-muted-foreground/50 border border-foreground/8 dark:border-white/10">
                            Em breve
                        </span>
                    )}
                </span>
            )}
        </span>
    );

    if (href) {
        return <Link href={href} className="w-full block">{inner}</Link>;
    }

    return <button className="w-full">{inner}</button>;
}

const GRANDE_AREAS = [
    { label: 'Clínica Médica',           slug: 'clinica-medica',           initials: 'CM'   },
    { label: 'Cirurgia Geral',            slug: 'cirurgia-geral',           initials: 'CG'   },
    { label: 'Preventiva',               slug: 'preventiva',               initials: 'Prev' },
    { label: 'Ginecologia e Obstetrícia', slug: 'ginecologia-obstetricia',  initials: 'GO'   },
    { label: 'Pediatria',                slug: 'pediatria',                initials: 'Ped'  },
];

export function DashboardSidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                setCollapsed(true);
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <aside
            className={cn(
                "h-full flex flex-col bg-sidebar-background/80 dark:bg-muted/10 backdrop-blur-3xl shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_24px_-12px_rgba(0,0,0,0.4)] border-r border-sidebar-border dark:border-white/5 transition-all duration-300 overflow-hidden shrink-0 z-10",
                collapsed ? "w-[60px]" : "w-full md:w-[240px] xl:w-[280px]"
            )}
        >
            <div className={cn("flex items-center px-4 py-2 border-b border-sidebar-border dark:border-border/10", collapsed ? "justify-center px-0" : "justify-end")}>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                >
                    {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
            </div>

            <nav className="flex-1 pt-0 pb-4 overflow-y-auto overflow-x-hidden scrollbar-none">
                <SidebarItem
                    icon={LayoutDashboard}
                    label="Principal"
                    collapsed={collapsed}
                    href="/statistics"
                    active={pathname === '/statistics'}
                />

                {/* Spacer Section 1 */}
                <div className="h-8" aria-hidden="true" />

                <div className="mb-2">
                    {!collapsed && <div className="px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/70">Grandes Áreas</div>}
                </div>

                <div className="flex flex-col space-y-1">
                    {GRANDE_AREAS.map(({ label, slug, initials }) => (
                        <SidebarItem
                            key={slug}
                            label={label}
                            initials={initials}
                            collapsed={collapsed}
                            isSubItem
                            href={`/statistics/${slug}`}
                            active={pathname === `/statistics/${slug}`}
                        />
                    ))}
                </div>

                {/* Spacer Section 2 */}
                <div className="h-8" aria-hidden="true" />

                <div className="mb-2">
                    {!collapsed && <div className="px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/70">Revisões Livres</div>}
                </div>

                <div className="flex flex-col space-y-1">
                    <SidebarItem label="Flashcards" collapsed={collapsed} comingSoon />
                    <SidebarItem label="Caderno de Erros" collapsed={collapsed} comingSoon />
                </div>
            </nav>
        </aside>
    );
}
