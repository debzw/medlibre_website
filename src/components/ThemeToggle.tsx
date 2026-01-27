import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { useAuthContext } from '@/contexts/AuthContext';

export function ThemeToggle() {
  const { user, profile, updateThemePreference } = useAuthContext();

  const { theme, toggleTheme } = useTheme({
    userId: user?.id,
    userThemePreference: profile?.theme_preference,
    onThemeChange: async (newTheme) => {
      if (updateThemePreference) {
        await updateThemePreference(newTheme);
      }
    },
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-muted-foreground hover:text-foreground"
      title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  );
}
