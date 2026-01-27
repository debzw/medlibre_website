import { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/services/logger";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        logger.error(error, { componentStack: errorInfo.componentStack }, "ErrorBoundary");
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado.</h1>
                    <p className="text-muted-foreground max-w-md mb-6">
                        Ocorreu um erro inesperado. Tente recarregar a página.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Recarregar Página
                        </Button>
                        <Button onClick={() => this.setState({ hasError: false })}>
                            Tentar Novamente
                        </Button>
                    </div>
                    {process.env.NODE_ENV === "development" && this.state.error && (
                        <pre className="mt-8 p-4 bg-muted rounded text-xs text-left overflow-auto max-w-lg">
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
