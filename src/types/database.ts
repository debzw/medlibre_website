export interface Question {
  id: string;
  numero: number | null;
  tipo: string | null;
  enunciado: string;
  texto_base: string | null;
  status_imagem: number | null;
  referencia_imagem: string | null;
  alternativa_a: string | null;
  alternativa_b: string | null;
  alternativa_c: string | null;
  alternativa_d: string | null;
  alternativa_e: string | null;
  imagem_alt_a: string | null;
  imagem_alt_b: string | null;
  imagem_alt_c: string | null;
  imagem_alt_d: string | null;
  imagem_alt_e: string | null;
  banca: string;
  ano: number;
  exam_type: string | null;
  processado: number | null;
  output_gabarito: string | null;
  output_explicacao: string | null;
  output_grande_area: string | null;
  output_especialidade: string | null;
  output_tema: string | null;
  output_subtema: string | null;
  output_taxa_certeza: number | null;
  tem_anomalia: number | null;
  log_anomalia: string | null;
  imagem_nova: string | null;
  opcoes: string[] | any;
  resposta_correta: number;
  created_at: string;
  campo_medico?: string;
  especialidade?: string | null;
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

export interface QuestionHistoryEntry {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer: number;
  is_correct: boolean;
  answered_at: string;
  time_spent_seconds: number | null;
  campo_medico?: string;
  banca?: string;
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

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: any[];
      };
    };
    Views: {
      [key: string]: {
        Row: any;
      };
    };
    Functions: {
      [key: string]: {
        Args: any;
        Returns: any;
      };
    };
    Enums: {
      [key: string]: any;
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
};
