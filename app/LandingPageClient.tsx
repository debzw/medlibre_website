'use client';

import { Button } from '@/components/ui/button';
import { Sparkles, Target } from 'lucide-react';
import Link from 'next/link';

export default function LandingPageClient() {

    return (
        <div className="min-h-screen bg-background relative flex flex-col">
            {/* Background decoration */}
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />


            {/* Hero Section - Full Viewport */}
            <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative">
                <div className="max-w-4xl w-full text-center space-y-12 animate-fade-in z-10">
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-6">
                            <div className="animate-fade-in">
                                <img src="/logo_withname.svg" alt="Medlibre" className="h-20 md:h-32 mx-auto dark:hidden" />
                                <img src="/logo_withname_white.svg" alt="edlibre" className="h-20 md:h-32 mx-auto hidden dark:block" />
                            </div>
                        </div>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Mudando o jogo. <br />
                            O fim da era das vídeo-aulas.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 max-w-xl mx-auto w-full px-4">
                        <Link href="/app" className="contents">
                            <Button
                                size="lg"
                                className="h-auto py-8 text-lg flex flex-col gap-3 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-primary/25 border border-primary/20"
                            >
                                <Sparkles className="w-8 h-8 mb-1 text-primary-foreground/90" />
                                <div>
                                    <span className="font-bold block text-xl">Não pensa, só vai</span>
                                    <span className="text-sm font-normal opacity-90">Deixa o algoritmo te levar</span>
                                </div>
                            </Button>
                        </Link>

                        <Link href="/setup" className="contents">
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-auto py-8 text-lg flex flex-col gap-3 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur border-border hover:border-primary/50 hover:bg-primary/5"
                            >
                                <Target className="w-8 h-8 mb-1 text-primary" />
                                <div>
                                    <span className="font-bold block text-xl">Modo Focado</span>
                                    <span className="text-sm font-normal text-muted-foreground">Escolha temas específicos</span>
                                </div>
                            </Button>
                        </Link>
                    </div>

                </div>


            </div>
        </div>
    );
}
