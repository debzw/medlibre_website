'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-black text-destructive">Algo deu errado!</h1>
                <p className="text-muted-foreground">{error.message}</p>
                <button
                    onClick={() => reset()}
                    className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Tentar novamente
                </button>
            </div>
        </div>
    );
}
