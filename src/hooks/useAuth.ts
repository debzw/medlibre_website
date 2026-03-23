import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/database';

// MODO DEV: Altere para false quando quiser testar o login real
export const DEV_MODE = false;

// UUID válido para o usuário dev (para compatibilidade com o banco de dados)
const DEV_USER_ID = 'e34e0ceb-2396-42e5-b9fd-039ffbb44c52';

export function useAuth() {
  const [user, setUser] = useState<User | null>(
    DEV_MODE ? ({
      id: DEV_USER_ID,
      email: 'deborabitzum@gmail.com',
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as any) : null
  );

  const [session, setSession] = useState<Session | null>(
    DEV_MODE ? ({
      access_token: 'fake-token',
      token_type: 'bearer',
      user: { id: DEV_USER_ID, email: 'deborabitzum@gmail.com' }
    } as any) : null
  );

  const [profile, setProfile] = useState<UserProfile | null>(
    DEV_MODE ? ({
      id: DEV_USER_ID,
      tier: 'paid', // 'free' ou 'paid' - altera para testar limites
      questions_answered_today: 0,
      pdfs_exported_today: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
      theme_preference: 'dark',
      preferred_banca: null,
      full_name: null,
      email: 'deborabitzum@gmail.com',
      avatar_url: null,
      locale: 'pt-BR',
      university: null,
      age: null,
      graduation_year: null,
      email_confirmed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) : null
  );

  // IMPORTANTE: Em DEV_MODE, loading começa false para liberar a tela imediatamente
  const [loading, setLoading] = useState(!DEV_MODE);
  // Guard: impede chamadas concorrentes a fetchProfile (React StrictMode + onAuthStateChange + getSession disparam várias ao mesmo tempo)
  const isFetchingProfileRef = useRef(false);

  useEffect(() => {
    // dev mode is on, skip real auth handling
    if (DEV_MODE) {
      console.log("⚠️ MODO DEV ATIVADO: Simulando usuário logado.");
      return;
    }

    console.log(`[PERF] AUTH: start → ${performance.now().toFixed(0)}ms`);

    // dev mode is off, proceed with real auth handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id, session.user);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log(`[PERF] AUTH: getSession resolved → ${performance.now().toFixed(0)}ms | hasSession=${!!session}`);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id, session.user);
      } else {
        console.log(`[PERF] AUTH: no session → loading=false @ ${performance.now().toFixed(0)}ms`);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, sessionUser?: User) => {
    // Em modo DEV, ignoramos chamadas ao banco real para evitar erros 403/401
    if (DEV_MODE) return;
    // Evita chamadas concorrentes: React StrictMode + onAuthStateChange + getSession disparam juntos
    if (isFetchingProfileRef.current) {
      console.log(`[PERF] AUTH: fetchProfile skipped (already in progress)`);
      return;
    }
    isFetchingProfileRef.current = true;

    const _tProfile = performance.now();
    console.log(`[PERF] AUTH: fetchProfile started → ${_tProfile.toFixed(0)}ms`);

    // Usa sessionUser passado como parâmetro para evitar race condition com o state
    const currentUser = sessionUser ?? user;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setProfile(data as UserProfile);
        // Perfil criado pelo trigger com email_confirmed: false → envia e-mail de verificação
        // localStorage evita reenvio em refreshes enquanto o usuário aguarda confirmação
        if (data.email_confirmed === false) {
          const sentKey = `emailVerificationSent_${userId}`;
          if (!localStorage.getItem(sentKey)) {
            localStorage.setItem(sentKey, 'true');
            fetch('/api/auth/send-verification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, email: currentUser?.email }),
            }).catch(err => console.error('Error sending verification email:', err));
          }
        }
      } else {
        // PERFIL NÃO EXISTE: novo usuário — cria perfil com email_confirmed: false
        console.log("Perfil não encontrado. Criando perfil padrão...");
        const metadata = currentUser?.user_metadata || {};
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert([
            {
              id: userId,
              email: currentUser?.email || null,
              full_name: metadata.full_name || null,
              avatar_url: metadata.avatar_url || metadata.picture || null,
              locale: metadata.locale || null,
              university: null,
              tier: 'free',
              questions_answered_today: 0,
              last_reset_date: new Date().toISOString().split('T')[0],
              theme_preference: 'dark',
              email_confirmed: false,
            }
          ])
          .select()
          .single();

        if (createError) {
          console.error('Error creating default profile:', createError);
        } else if (newProfile) {
          setProfile(newProfile as UserProfile);
          // Dispara envio do e-mail de verificação (não bloqueia o fluxo)
          fetch('/api/auth/send-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, email: currentUser?.email }),
          }).catch(err => console.error('Error sending verification email:', err));
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      isFetchingProfileRef.current = false;
      console.log(`[PERF] AUTH: fetchProfile done → ${performance.now().toFixed(0)}ms (profile query: ${(performance.now() - _tProfile).toFixed(0)}ms)`);
      setLoading(false);
    }
  };

  // Funções de login mantidas (mas não farão nada visualmente se DEV_MODE estiver travado)
  const signInWithGoogle = async () => { if (DEV_MODE) return { error: null }; const redirectUrl = `${window.location.origin}/auth/callback`; const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl, scopes: 'email profile' } }); return { error }; };
  const signInWithEmail = async (email: string, password: string) => { if (DEV_MODE) return { error: null }; const { error } = await supabase.auth.signInWithPassword({ email, password }); return { error }; };
  const signUpWithEmail = async (email: string, password: string) => { if (DEV_MODE) return { error: null }; const redirectUrl = window.location.origin; const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl } }); return { error }; };
  const signOut = async () => {
    if (DEV_MODE) { alert("Você está no modo DEV (Hardcoded). Edite o useAuth.ts para sair."); return { error: null }; }
    const { error } = await supabase.auth.signOut(); return { error };
  };
  const refreshProfile = async () => { if (user) { isFetchingProfileRef.current = false; await fetchProfile(user.id); } };

  const updateThemePreference = async (theme: 'light' | 'dark') => {
    if (DEV_MODE) {
      // Update local state in dev mode
      setProfile(prev => prev ? { ...prev, theme_preference: theme } : null);
      return { error: null };
    }

    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ theme_preference: theme })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating theme preference:', error);
        return { error };
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, theme_preference: theme } : null);
      return { error: null };
    } catch (err) {
      console.error('Error updating theme preference:', err);
      return { error: err };
    }
  };

  const updatePreferredBanca = async (banca: string | null) => {
    return updateProfile({ preferred_banca: banca });
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (DEV_MODE) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    }

    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        return { error };
      }

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { error: err };
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
    updateThemePreference,
    updatePreferredBanca,
    updateProfile,
  };
}