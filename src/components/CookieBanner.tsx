'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function CookieBanner() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie-consent', 'accepted');
        setIsVisible(false);
    };

    const handleReject = () => {
        localStorage.setItem('cookie-consent', 'rejected');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50 shadow-lg animate-in slide-in-from-bottom duration-500">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground flex-1">
                    <p>
                        Nós utilizamos cookies para melhorar sua experiência e analisar o tráfego.
                        Ao continuar navegando, você concorda com nossa{' '}
                        <a href="/privacy" className="text-primary hover:underline underline-offset-4">
                            Política de Privacidade
                        </a>.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReject}>
                        Recusar
                    </Button>
                    <Button size="sm" onClick={handleAccept}>
                        Aceitar
                    </Button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="md:hidden absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                        aria-label="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
