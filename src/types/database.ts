export interface Question {
  id: string;
  banca: string;
  ano: number;
  enunciado: string;
  imagem_url: string | null;
  opcoes: string[];
  resposta_correta: number;
  created_at: string;
  // New fields from Supabase schema
  campo_medico?: string; // Legacy field for UI compatibility
  especialidade?: string | null;
  output_grande_area?: string | null;
  output_especialidade?: string | null;
  output_tema?: string | null;
  output_subtema?: string | null;
  output_explicacao?: string | null;
  output_gabarito?: string | null;
  status_imagem?: number | null;
  referencia_imagem?: string | null;
}

export interface UserProfile {
  id: string;
  tier: 'free' | 'paid';
  questions_answered_today: number;
  pdfs_exported_today: number;
  last_reset_date: string;
  theme_preference: 'light' | 'dark' | null;
  preferred_banca: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  locale: string | null;
  university: string | null;
  age: number | null;
  graduation_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface FilterOptions {
  bancas: string[];
  anos: number[];
  campos: string[];
}

export interface GuestUsage {
  questionsAnswered: number;
  lastResetDate: string;
}

export type UserType = 'guest' | 'free' | 'paid';

export interface UserSpacedRepetition {
  id: string;
  user_id: string;
  question_id: string;
  interval: number;
  ease_factor: number;
  streak: number;
  next_review: string;
  last_reviewed: string;
  created_at: string;
}

export interface UserThemeStats {
  id: string;
  user_id: string;
  theme_name: string;
  total_answered: number;
  total_correct: number;
  mastery_score: number;
  last_updated: string;
}

export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

export interface Report {
  id: string;
  user_id: string | null;
  type: string;
  category: string;
  target_id: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  status: ReportStatus | string | null;
  created_at: string;
}
