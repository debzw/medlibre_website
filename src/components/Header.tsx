'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { LogIn, LogOut, User, Crown, BarChart3, Info, Target, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  const { user, profile, signOut, userType, getRemainingQuestions } = useAuthContext();
  const pathname = usePathname();

  // Hide header on landing page and pricing page
  if (pathname === '/' || pathname === '/pricing') {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const remaining = getRemainingQuestions();
  const showLimit = userType !== 'paid';

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo and Navigation Group */}
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center">
            <img src="/logo_withname.svg" alt="medlibre" className="h-8 dark:hidden" />
            <img src="/logo_withname_white.svg" alt="medlibre" className="h-8 hidden dark:block" />
          </Link>

          {/* Navigation links - desktop */}
          <nav className="hidden md:flex items-center gap-1">

            <Link href="/setup">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Target className="w-4 h-4" />
                Focado
              </Button>
            </Link>
            <Link href="/app">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Sparkles className="w-4 h-4" />
                Questões
              </Button>
            </Link>
            <Link href="/statistics">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Estatísticas
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Info className="w-4 h-4" />
                Sobre
              </Button>
            </Link>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Usage indicator */}
          {showLimit && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-sm">
              <span className="text-muted-foreground">Restantes:</span>
              <span className="font-semibold text-foreground">{remaining === Infinity ? '∞' : remaining}</span>
            </div>
          )}

          {/* User actions */}
          {user ? (
            <div className="flex items-center gap-2 md:gap-3">
              {userType === 'paid' && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Crown className="w-4 h-4" />
                  <span>Premium Beta</span>
                </div>
              )}

              <Link href="/profile" className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground max-w-[150px] truncate">
                  {profile?.full_name || user.email}
                </span>
              </Link>

              {/* Mobile nav links */}
              <div className="flex md:hidden items-center gap-1">
                <Link href="/setup">
                  <Button variant="ghost" size="icon">
                    <Target className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/app">
                  <Button variant="ghost" size="icon">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/statistics">
                  <Button variant="ghost" size="icon">
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button variant="ghost" size="icon">
                    <Info className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {/* Mobile nav links for guests */}
              <div className="flex md:hidden items-center gap-1">
                <Link href="/setup">
                  <Button variant="ghost" size="icon">
                    <Target className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/app">
                  <Button variant="ghost" size="icon">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/statistics">
                  <Button variant="ghost" size="icon">
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button variant="ghost" size="icon">
                    <Info className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <Link href="/auth">
                <Button variant="default" size="sm" className="btn-amber">
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
