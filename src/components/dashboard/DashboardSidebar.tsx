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
    label: string;
    active?: boolean;
    isSubItem?: boolean;
    collapsed: boolean;
    href?: string;
}

function SidebarItem({ icon: Icon, label, active, isSubItem, collapsed, href }: SidebarItemProps) {
    const inner = (
        <span
            className={cn(
                "w-full flex items-center transition-colors hover:bg-sidebar-accent dark:hover:bg-white/10 text-sm py-3",
                collapsed ? "justify-center px-0" : "px-6",
                active ? "bg-sidebar-accent border-l-4 border-primary text-foreground font-semibold dark:bg-white/5" : "text-muted-foreground border-l-4 border-transparent",
                isSubItem && !collapsed ? "pl-10" : ""
            )}
        >
            {Icon && <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-5 w-5 mr-3", active ? "text-primary" : "")} />}
            {!collapsed && <span className="truncate">{label}</span>}
        </span>
    );

    if (href) {
        return <Link href={href} className="w-full block">{inner}</Link>;
    }

    return <button className="w-full">{inner}</button>;
}

const GRANDE_AREAS = [
    { label: 'Clínica Médica',           slug: 'clinica-medica' },
    { label: 'Cirurgia Geral',            slug: 'cirurgia-geral' },
    { label: 'Preventiva',               slug: 'preventiva' },
    { label: 'Ginecologia e Obstetrícia', slug: 'ginecologia-obstetricia' },
    { label: 'Pediatria',                slug: 'pediatria' },
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
                "h-full flex flex-col bg-sidebar-background dark:bg-card/40 backdrop-blur-xl border-r border-sidebar-border dark:border-border/50 transition-all duration-300 overflow-hidden shrink-0",
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
                    {GRANDE_AREAS.map(({ label, slug }) => (
                        <SidebarItem
                            key={slug}
                            label={label}
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
                    <SidebarItem label="Flashcards" collapsed={collapsed} />
                    <SidebarItem label="Caderno de Erros" collapsed={collapsed} />
                </div>
            </nav>
        </aside>
    );
}
