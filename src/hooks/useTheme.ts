import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface UseThemeOptions {
  userId?: string | null;
  userThemePreference?: 'light' | 'dark' | null;
  onThemeChange?: (theme: Theme) => Promise<void>;
}

export function useTheme(options: UseThemeOptions = {}) {
  const { userId, userThemePreference, onThemeChange } = options;

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      // For authenticated users, use their database preference
      if (userId && userThemePreference) {
        return userThemePreference;
      }

      // Check localStorage (for both guests and authenticated users without preference)
      const saved = localStorage.getItem('medlibre-theme') as Theme;
      if (saved) return saved;

      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }

      // Default to light if no system preference for dark is found
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('medlibre-theme', theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    // If user is authenticated and has an onThemeChange callback, sync to database
    if (userId && onThemeChange) {
      await onThemeChange(newTheme);
    }
  };

  return { theme, setTheme, toggleTheme };
}
