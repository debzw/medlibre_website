import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Carregando questões...' }: LoadingStateProps) {
  return (
    <div className="card-elevated p-12 text-center animate-fade-in">
      <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
