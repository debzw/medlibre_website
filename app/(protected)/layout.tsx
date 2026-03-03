'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { BetaWelcomeModal } from "@/components/modals/BetaWelcomeModal";

// Routes accessible without authentication (guest mode supported)
const GUEST_ALLOWED_ROUTES = ['/app', '/setup'];

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, needsEmailVerification } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;
        if (!user && !GUEST_ALLOWED_ROUTES.includes(pathname)) {
            router.replace('/auth');
            return;
        }
        if (user && needsEmailVerification) {
            router.replace('/verify-email');
        }
    }, [loading, user, needsEmailVerification, router, pathname]);

    return (
        <>
            <BetaWelcomeModal />
            {children}
        </>
    );
}
