export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
                <h1 className="text-6xl font-black text-primary">404</h1>
                <h2 className="text-2xl font-bold">Página não encontrada</h2>
                <p className="text-muted-foreground">A página que você procura não existe.</p>
                <a href="/" className="inline-block mt-4 text-primary hover:underline">
                    Voltar para a página inicial
                </a>
            </div>
        </div>
    );
}
