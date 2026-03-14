import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, User, ArrowRight } from 'lucide-react';
import { AdBanner } from '@/components/AdBanner';
import Link from 'next/link';
import { blogPostsList } from './_data/posts';

export const metadata: Metadata = {
    title: 'Blog | Ciência do Aprendizado para Residência Médica',
    description: 'Artigos baseados em evidências sobre como estudar para residência médica: repetição espaçada, active recall, banco de questões e neurociência do aprendizado.',
    keywords: [
        'como estudar residência médica',
        'repetição espaçada medicina',
        'active recall residência',
        'banco de questões residência',
        'ciência do aprendizado medicina',
        'estudo eficiente medicina',
    ],
    openGraph: {
        title: 'Blog Medlibre | Ciência do Aprendizado para Residência Médica',
        description: 'Artigos baseados em evidências sobre como estudar para residência médica com o máximo de eficiência.',
        type: 'website',
        url: 'https://medlibre.com.br/blog',
        siteName: 'Medlibre',
        locale: 'pt_BR',
    },
    alternates: {
        canonical: 'https://medlibre.com.br/blog',
    },
};

export default function BlogPage() {
    return (
        <div className="container mx-auto px-4 py-12">
            <div className="text-center space-y-4 mb-10">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">Blog Medlibre</h1>
                <p className="text-xl text-muted-foreground">Conteúdo estratégico para quem não quer perder tempo.</p>
            </div>

            {/* Horizontal ad banner below header */}
            <div className="max-w-4xl mx-auto mb-10">
                <AdBanner variant="horizontal" slotId="4931237635" className="rounded-xl" />
            </div>

            <div className="max-w-6xl mx-auto flex gap-10">
                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {blogPostsList.map((post, index) => (
                            <Link key={index} href={`/blog/${post.slug}`}>
                                <Card className="card-elevated group cursor-pointer hover:border-primary/50 transition-all duration-300 h-full">
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
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Sidebar with ads */}
                <aside className="hidden lg:flex flex-col gap-6 w-[160px] shrink-0">
                    <AdBanner variant="sidebar" slotId="5722542728" />
                </aside>
            </div>
        </div>
    );
}
