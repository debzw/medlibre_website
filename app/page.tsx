import type { Metadata } from 'next';
import LandingPageClient from './LandingPageClient';

export const metadata: Metadata = {
    title: 'medlibre - Preparação Gratuita para Residência Médica | Banco de Questões',
    description: 'Plataforma gratuita de preparação para residência médica com banco de questões das principais bancas do Brasil (USP, UNIFESP, ENARE). Estude com ciência: repetição espaçada e recuperação ativa.',
};

export default function HomePage() {
    return <LandingPageClient />;
}
