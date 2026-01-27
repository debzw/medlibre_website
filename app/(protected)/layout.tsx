'use client';

import { Header } from '@/components/Header';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Header />
            <main className="flex-1">{children}</main>
        </>
    );
}
