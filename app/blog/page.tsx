'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, User, ArrowRight } from 'lucide-react';

const blogPosts = [
    {
        title: 'Como Estudar para Residência Médica em 2024',
        excerpt: 'Descubra as melhores estratégias e cronogramas para garantir sua aprovação nas principais instituições.',
        date: '27 Jan 2026',
        author: 'Equipe medlibre',
        slug: 'como-estudar-residencia-2024',
    },
    {
        title: 'O que é Repetição Espaçada (SRS)?',
        excerpt: 'Entenda a ciência por trás da memorização de longo prazo e como o medlibre utiliza isso a seu favor.',
        date: '25 Jan 2026',
        author: 'Equipe medlibre',
        slug: 'o-que-e-repeticao-espacada',
    },
    {
        title: 'Active Recall: A Técnica Definitiva',
        excerpt: 'Por que ler e reler é perda de tempo, e como a recuperação ativa muda o jogo do seu aprendizado.',
        date: '20 Jan 2026',
        author: 'Equipe medlibre',
        slug: 'active-recall-tecnica-definitiva',
    },
];

export default function BlogPage() {
    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">Blog medlibre</h1>
                    <p className="text-xl text-muted-foreground">Conteúdo estratégico para quem não quer perder tempo.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {blogPosts.map((post, index) => (
                        <Card key={index} className="card-elevated group cursor-pointer hover:border-primary/50 transition-all duration-300">
                            <CardHeader className="space-y-4">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-wider">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {post.date}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" /> {post.author}
                                    </span>
                                </div>
                                <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">
                                    {post.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <p className="text-muted-foreground leading-relaxed">{post.excerpt}</p>
                                <Button variant="ghost" className="p-0 hover:bg-transparent text-primary font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                                    Ler mais <ArrowRight className="w-4 h-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="bg-secondary/30 p-8 rounded-3xl border border-border text-center space-y-4 mt-20">
                    <h3 className="text-2xl font-bold">Quer ser notificado sobre novos posts?</h3>
                    <p className="text-muted-foreground">Inscreva-se na nossa newsletter (em breve).</p>
                    <div className="flex max-w-md mx-auto gap-2">
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            className="flex-1 bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                            disabled
                        />
                        <Button disabled>Avisar-me</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
