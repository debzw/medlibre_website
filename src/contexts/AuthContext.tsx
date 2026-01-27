import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { User, Session } from '@supabase/supabase-js';
import { UserProfile, UserType } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  userType: UserType;
  questionsUsed: number;
  canAnswerMore: () => boolean;
  getRemainingQuestions: () => number;
  getLimit: () => number;
  incrementUsage: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  updateThemePreference: (theme: 'light' | 'dark') => Promise<{ error: any }>;
  updatePreferredBanca: (banca: string | null) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const usage = useUsageLimit(auth.profile, !!auth.user);

  const value: AuthContextType = {
    ...auth,
    userType: usage.userType,
    questionsUsed: usage.questionsUsed,
    canAnswerMore: usage.canAnswerMore,
    getRemainingQuestions: usage.getRemainingQuestions,
    getLimit: usage.getLimit,
    incrementUsage: usage.incrementUsage,
    updateThemePreference: auth.updateThemePreference,
    updatePreferredBanca: auth.updatePreferredBanca,
    updateProfile: auth.updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
