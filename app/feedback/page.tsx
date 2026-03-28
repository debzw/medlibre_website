import type { Metadata } from 'next';
import FeedbackForm from './FeedbackForm';

export const metadata: Metadata = {
  title: 'Feedback — MedLibre',
  description: 'Compartilhe sua experiência e ganhe 3 meses de Premium grátis.',
  robots: { index: false },
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function FeedbackPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <FeedbackForm token={token ?? ''} />;
}
