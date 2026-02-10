'use client';



import { BetaWelcomeModal } from "@/components/modals/BetaWelcomeModal";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <BetaWelcomeModal />
            {children}
        </>
    );
}
