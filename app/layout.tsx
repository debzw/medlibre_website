import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Footer } from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: {
        default: 'medlibre | Preparação para Residência Médica',
        template: '%s | medlibre',
    },
    description: 'Plataforma gratuita de preparação para residência médica com banco de questões das principais bancas (USP, UNIFESP, ENARE). Estude com ciência: repetição espaçada (SRS) e recuperação ativa (Active Recall).',
    keywords: [
        'residência médica',
        'questões residência',
        'banco de questões medicina',
        'preparação residência',
        'ENARE',
        'USP',
        'UNIFESP',
        'repetição espaçada medicina',
        'active recall medicina',
        'flashcards medicina',
        'estudo ativo medicina'
    ],
    authors: [{ name: 'medlibre' }],
    creator: 'medlibre',
    publisher: 'medlibre',
    metadataBase: new URL('https://medlibre.com.br'),
    openGraph: {
        type: 'website',
        locale: 'pt_BR',
        url: 'https://medlibre.com.br',
        siteName: 'medlibre',
        title: 'medlibre | Preparação para Residência Médica com Ciência',
        description: 'Plataforma gratuita de preparação para residência médica. Estude com repetição espaçada e recuperação ativa. Banco de questões verificado.',
        images: [
            {
                url: '/logo_withname.png',
                width: 1200,
                height: 630,
                alt: 'medlibre - Preparação para Residência',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        site: '@medlibre_',
        creator: '@medlibre_',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className={`${inter.className} min-h-screen flex flex-col`}>
                <Providers>
                    <div className="flex-1 flex flex-col">
                        {children}
                    </div>
                    <Footer />
                </Providers>
            </body>
        </html>
    );
}
