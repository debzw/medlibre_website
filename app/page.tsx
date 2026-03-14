import type { Metadata } from 'next';
import LandingPageClient from './LandingPageClient';

export const metadata: Metadata = {
    title: 'Medlibre - Preparação Gratuita para Residência Médica | Banco de Questões gratuito',
    description: 'Plataforma gratuita de preparação para residência médica com banco de questões das principais bancas do Brasil (USP, UNIFESP, ENARE). Estude com ciência: repetição espaçada e recuperação ativa.',
    keywords: [
        'banco de questões residência médica grátis',
        'banco de questões residência gratis',
        'estudo residência médica',
        'questões residência médica',
        'preparação residência médica gratuita',
        'ENARE questões',
        'USP residência médica',
        'UNIFESP residência',
        'repetição espaçada medicina',
        'active recall medicina',
        'estudo medicina gratuito',
    ],
    openGraph: {
        title: 'Medlibre | Banco de Questões Gratuito para Residência Médica',
        description: 'Plataforma gratuita de preparação para residência médica. Banco de questões USP, UNIFESP, ENARE com repetição espaçada e active recall. Sem mensalidade.',
        type: 'website',
        url: 'https://medlibre.com.br',
        siteName: 'Medlibre',
        locale: 'pt_BR',
        images: [
            {
                url: '/logo.png',
                width: 1200,
                height: 630,
                alt: 'Medlibre - Banco de Questões Gratuito para Residência Médica',
            },
        ],
    },
    alternates: {
        canonical: 'https://medlibre.com.br',
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': 'https://medlibre.com.br/#organization',
            name: 'Medlibre',
            url: 'https://medlibre.com.br',
            description: 'Plataforma gratuita de banco de questões e preparação para residência médica no Brasil. Questões USP, UNIFESP, ENARE com algoritmo de repetição espaçada FSRS.',
            foundingDate: '2025',
            inLanguage: 'pt-BR',
            logo: {
                '@type': 'ImageObject',
                url: 'https://medlibre.com.br/logo.png',
            },
            contactPoint: {
                '@type': 'ContactPoint',
                email: 'institucional@medlibre.com.br',
                contactType: 'customer support',
                availableLanguage: 'Portuguese',
            },
            sameAs: [],
        },
        {
            '@type': 'WebSite',
            '@id': 'https://medlibre.com.br/#website',
            url: 'https://medlibre.com.br',
            name: 'Medlibre',
            description: 'Banco de questões gratuito para residência médica com repetição espaçada',
            publisher: {
                '@id': 'https://medlibre.com.br/#organization',
            },
            inLanguage: 'pt-BR',
        },
        {
            '@type': 'WebPage',
            '@id': 'https://medlibre.com.br/#webpage',
            url: 'https://medlibre.com.br',
            name: 'Medlibre - Banco de Questões Gratuito para Residência Médica',
            description: 'Plataforma gratuita de preparação para residência médica com banco de questões das principais bancas do Brasil.',
            isPartOf: { '@id': 'https://medlibre.com.br/#website' },
            about: { '@id': 'https://medlibre.com.br/#organization' },
            inLanguage: 'pt-BR',
        },
    ],
};

export default function HomePage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Visually hidden H1 for SEO — accessible to Google and screen readers */}
            <h1 className="sr-only">
                Medlibre — Banco de Questões Gratuito para Residência Médica
            </h1>
            <LandingPageClient />
        </>
    );
}
