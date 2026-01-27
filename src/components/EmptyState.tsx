import { Search } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = 'Nenhuma questão encontrada',
  description = 'Tente ajustar os filtros para encontrar mais questões.',
}: EmptyStateProps) {
  return (
    <div className="card-elevated p-12 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
        <Search className="w-8 h-8 text-muted-foreground" />
      </div>

      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
