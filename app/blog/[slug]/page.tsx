import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { blogPosts } from '../_data/posts';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
    return Object.keys(blogPosts).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = blogPosts[slug];
    if (!post) return {};

    return {
        title: post.title,
        description: post.excerpt,
        keywords: [
            'residência médica',
            'banco de questões residência',
            'estudo medicina',
            post.title,
        ],
        authors: [{ name: post.author }],
        openGraph: {
            title: post.title,
            description: post.excerpt,
            type: 'article',
            publishedTime: post.dateISO,
            authors: [post.author],
            url: `https://medlibre.com.br/blog/${slug}`,
            siteName: 'Medlibre',
            locale: 'pt_BR',
        },
        alternates: {
            canonical: `https://medlibre.com.br/blog/${slug}`,
        },
    };
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;
    const post = blogPosts[slug];
    if (!post) notFound();

    const paragraphs = post.content.split('\n\n');

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt,
                datePublished: post.dateISO,
                dateModified: post.dateISO,
                author: {
                    '@type': 'Organization',
                    name: 'Equipe Medlibre',
                    url: 'https://medlibre.com.br',
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Medlibre',
                    url: 'https://medlibre.com.br',
                    logo: {
                        '@type': 'ImageObject',
                        url: 'https://medlibre.com.br/logo.png',
                    },
                },
                mainEntityOfPage: {
                    '@type': 'WebPage',
                    '@id': `https://medlibre.com.br/blog/${slug}`,
                },
                url: `https://medlibre.com.br/blog/${slug}`,
                inLanguage: 'pt-BR',
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Blog',
                        item: 'https://medlibre.com.br/blog',
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: post.title,
                        item: `https://medlibre.com.br/blog/${slug}`,
                    },
                ],
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-6xl mx-auto flex gap-10">
                    {/* Main content */}
                    <article className="flex-1 min-w-0 space-y-8">
                        <Link href="/blog">
                            <Button variant="ghost" className="p-0 hover:bg-transparent text-muted-foreground flex items-center gap-2 mb-6">
                                <ArrowLeft className="w-4 h-4" /> Voltar ao blog
                            </Button>
                        </Link>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {post.date}
                                </span>
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" /> {post.author}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{post.title}</h1>
                        </div>

                        <Card className="p-8">
                            <div className="prose prose-invert max-w-none space-y-4">
                                {paragraphs.map((paragraph, i) => {
                                    if (paragraph.startsWith('## ')) {
                                        return (
                                            <h2 key={i} className="text-2xl font-bold mt-8 mb-4">
                                                {paragraph.replace('## ', '')}
                                            </h2>
                                        );
                                    }
                                    if (paragraph.startsWith('### ')) {
                                        return (
                                            <h3 key={i} className="text-xl font-bold mt-6 mb-3">
                                                {paragraph.replace('### ', '')}
                                            </h3>
                                        );
                                    }
                                    if (paragraph.startsWith('![')) {
                                        const match = paragraph.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                                        if (match) {
                                            return (
                                                <figure key={i} className="my-6">
                                                    <Image
                                                        src={match[2]}
                                                        alt={match[1]}
                                                        width={800}
                                                        height={450}
                                                        className="rounded-xl w-full object-contain"
                                                    />
                                                    {match[1] && (
                                                        <figcaption className="text-center text-xs text-muted-foreground mt-2">{match[1]}</figcaption>
                                                    )}
                                                </figure>
                                            );
                                        }
                                    }
                                    if (paragraph.match(/^\d+\./)) {
                                        const items = paragraph.split('\n').filter(Boolean);
                                        return (
                                            <ol key={i} className="list-decimal list-inside space-y-1 text-muted-foreground">
                                                {items.map((item, j) => (
                                                    <li key={j}>{item.replace(/^\d+\.\s/, '')}</li>
                                                ))}
                                            </ol>
                                        );
                                    }
                                    if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                                        const items = paragraph.split('\n').filter(Boolean);
                                        return (
                                            <ul key={i} className="list-disc list-inside space-y-1 text-muted-foreground">
                                                {items.map((item, j) => (
                                                    <li key={j}>{item.replace(/^[-*]\s/, '')}</li>
                                                ))}
                                            </ul>
                                        );
                                    }
                                    if (paragraph.startsWith('| ')) {
                                        const rows = paragraph.split('\n').filter(Boolean);
                                        return (
                                            <div key={i} className="overflow-x-auto my-4">
                                                <table className="w-full text-sm text-muted-foreground border-collapse">
                                                    <tbody>
                                                    {rows.map((row, j) => {
                                                        if (row.match(/^[\|\s\-]+$/)) return null;
                                                        const cells = row.split('|').filter(c => c.trim());
                                                        return (
                                                            <tr key={j} className="border-b border-border">
                                                                {cells.map((cell, k) => (
                                                                    j === 0
                                                                        ? <th key={k} className="py-2 px-3 text-left font-semibold text-foreground">{cell.trim()}</th>
                                                                        : <td key={k} className="py-2 px-3">{cell.trim()}</td>
                                                                ))}
                                                            </tr>
                                                        );
                                                    })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    }
                                    if (paragraph.includes('[') && paragraph.includes('](/blog/')) {
                                        const parts = paragraph.split(/(\[[^\]]+\]\([^)]+\))/);
                                        return (
                                            <p key={i} className="text-muted-foreground leading-relaxed">
                                                {parts.map((part, j) => {
                                                    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
                                                    if (linkMatch) {
                                                        return (
                                                            <Link key={j} href={linkMatch[2]} className="text-primary underline hover:text-primary/80">
                                                                {linkMatch[1]}
                                                            </Link>
                                                        );
                                                    }
                                                    return part;
                                                })}
                                            </p>
                                        );
                                    }
                                    return (
                                        <p key={i} className="text-muted-foreground leading-relaxed">
                                            {paragraph}
                                        </p>
                                    );
                                })}
                            </div>
                        </Card>

                        {/* CTA para o banco de questões */}
                        <Card className="p-8 border-primary/30 bg-primary/5">
                            <div className="text-center space-y-4">
                                <h2 className="text-2xl font-bold">Pratique com o banco de questões gratuito</h2>
                                <p className="text-muted-foreground">
                                    Aplique o que aprendeu neste artigo com questões reais das bancas USP, UNIFESP, ENARE e mais.
                                    Repetição espaçada com algoritmo FSRS incluso — sem pagar nada.
                                </p>
                                <Link href="/app">
                                    <Button size="lg" className="mt-2">
                                        Acessar banco de questões gratuito
                                    </Button>
                                </Link>
                            </div>
                        </Card>

                        <div className="flex justify-center pt-4">
                            <Link href="/blog">
                                <Button variant="outline">Ver todos os artigos</Button>
                            </Link>
                        </div>
                    </article>

                </div>
            </div>
        </>
    );
}
