import { cn } from '@/lib/utils';

interface AdBannerProps {
  variant?: 'sidebar' | 'horizontal' | 'square';
  className?: string;
}

export function AdBanner({ variant = 'sidebar', className }: AdBannerProps) {
  const sizeClasses = {
    sidebar: 'w-full h-[600px]',
    horizontal: 'w-full h-24',
    square: 'w-[300px] h-[250px]',
  };

  return (
    <div
      className={cn(
        'ad-placeholder',
        sizeClasses[variant],
        className
      )}
    >
      <div className="text-center p-4">
        <p className="font-medium text-muted-foreground">Espaço Publicitário</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {variant === 'sidebar' ? '160x600' : variant === 'horizontal' ? 'Leaderboard' : '300x250'}
        </p>
      </div>
    </div>
  );
}
