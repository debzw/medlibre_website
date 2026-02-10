export const Footer = () => {
    return (
        <footer className="py-8 mt-auto border-t bg-background/50 backdrop-blur-sm">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left mb-8">
                    <div className="space-y-4">
                        <img src="/logo_withname.svg" alt="medlibre" className="h-8 mx-auto md:mx-0 dark:hidden" />
                        <img src="/logo_withname_white.svg" alt="medlibre" className="h-8 mx-auto md:mx-0 hidden dark:block" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            A plataforma inteligente para quem quer passar na residência médica sem perder tempo com vídeo-aulas.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h4 className="font-bold uppercase text-xs tracking-widest text-primary">Plataforma</h4>
                        <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">Home</a>
                        <a href="/app" className="text-sm text-muted-foreground hover:text-primary transition-colors">Praticar</a>
                        <a href="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Preços</a>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h4 className="font-bold uppercase text-xs tracking-widest text-primary">Suporte</h4>
                        <a href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">Sobre Nós</a>
                        <a href="/sac" className="text-sm text-muted-foreground hover:text-primary transition-colors">SAC (FAQ)</a>
                        <a href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Política de Privacidade</a>
                        <a href="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">Blog</a>
                        <a href="mailto:institucional@medlibre.com.br" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contato</a>
                    </div>
                </div>
                <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} medlibre. Todos os direitos reservados.</p>
                </div>
            </div>
        </footer>
    );
};
