const InstagramIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
);

export const Footer = () => {
    return (
        <footer className="py-8 mt-auto border-t bg-background/50 backdrop-blur-sm">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-center md:justify-start">
                            <img src="/logo_withname.svg" alt="Medlibre" className="h-8 dark:hidden" />
                            <img src="/logo_withname_white.svg" alt="Medlibre" className="h-8 hidden dark:block" />
                            <a
                                href="https://www.instagram.com/medlibre.br/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors ml-[200px]"
                            >
                                <InstagramIcon className="h-5 w-5" />
                            </a>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            CNPJ: 65.628.534/0001-02
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            A plataforma inteligente para quem quer passar na residência médica sem perder tempo com vídeo-aulas.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h4 className="font-bold uppercase text-xs tracking-widest text-primary">Plataforma</h4>
                        <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">Home</a>
                        <a href="/app" className="text-sm text-muted-foreground hover:text-primary transition-colors">Praticar</a>
                        <a href="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Preços</a>
                        <a href="/profile" className="text-sm text-muted-foreground hover:text-primary transition-colors">Conta</a>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h4 className="font-bold uppercase text-xs tracking-widest text-primary">Suporte</h4>
                        <a href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">Sobre Nós</a>
                        <a href="/sac" className="text-sm text-muted-foreground hover:text-primary transition-colors">SAC (FAQ)</a>
                        <a href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Política de Privacidade</a>
                        <a href="/termos" className="text-sm text-muted-foreground hover:text-primary transition-colors">Termos de Uso</a>
                        <a href="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">Blog</a>
                        <a href="mailto:institucional@medlibre.com.br" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contato</a>
                    </div>
                </div>
                <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} Medlibre. Todos os direitos reservados.</p>
                </div>
            </div>
        </footer>
    );
};
