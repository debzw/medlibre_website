export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

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
    session_id?: string | null;
}

export interface StudySession {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    last_activity_at: string;
    questions_attempted: number;
    questions_correct: number;
    total_time_seconds: number;
    session_type: string;
}

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
    // FSRS v4 fields (null for legacy SM-2 records)
    stability: number | null;
    difficulty: number | null;
    last_confidence: number | null;
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

export interface Report {
    id: string;
    user_id: string | null;
    type: string;
    category: string;
    target_id: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    status: string | null;
    created_at: string;
}

export interface UserDailyStats {
    user_id: string;
    stat_date: string;      // DATE as string
    total_answered: number;
    total_correct: number;
    total_time_seconds: number;
}

export type Database = {
    public: {
        Tables: {
            questions: {
                Row: Question;
                Insert: Partial<Question>;
                Update: Partial<Question>;
                Relationships: any[];
            };
            user_profiles: {
                Row: UserProfile;
                Insert: Partial<UserProfile>;
                Update: Partial<UserProfile>;
                Relationships: any[];
            };
            user_question_history: {
                Row: QuestionHistoryEntry;
                Insert: Partial<QuestionHistoryEntry>;
                Update: Partial<QuestionHistoryEntry>;
                Relationships: any[];
            };
            user_spaced_repetition: {
                Row: UserSpacedRepetition;
                Insert: Partial<UserSpacedRepetition>;
                Update: Partial<UserSpacedRepetition>;
                Relationships: any[];
            };
            user_theme_stats: {
                Row: UserThemeStats;
                Insert: Partial<UserThemeStats>;
                Update: Partial<UserThemeStats>;
                Relationships: any[];
            };
            user_daily_stats: {
                Row: UserDailyStats;
                Insert: Partial<UserDailyStats>;
                Update: Partial<UserDailyStats>;
                Relationships: any[];
            };
            study_sessions: {
                Row: StudySession;
                Insert: Partial<StudySession>;
                Update: Partial<StudySession>;
                Relationships: any[];
            };
            reports: {
                Row: Report;
                Insert: Partial<Report>;
                Update: Partial<Report>;
                Relationships: any[];
            };
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
            get_study_session_questions: {
                Args: any;
                Returns: Question[];
            };
            get_user_stats: {
                Args: any;
                Returns: Json;
            };
            record_answer: {
                Args: {
                    p_question_id: string;
                    p_selected_answer: number;
                    p_is_correct: boolean;
                    p_time_spent?: number | null;
                    p_idempotency_key?: string;
                    p_source_bucket?: string;
                    p_session_id?: string | null;
                };
                Returns: { was_duplicate: boolean; today_count: number };
            };
            get_study_session_questions_v2: {
                Args: {
                    p_user_id: string;
                    p_limit?: number;
                    p_hide_answered?: boolean;
                    p_banca?: string | null;
                    p_ano?: number | null;
                    p_campo?: string | null;
                    p_especialidade?: string | null;
                    p_tema?: string | null;
                };
                Returns: (Question & { source_bucket: string })[];
            };
            start_study_session: {
                Args: { p_session_id: string; p_session_type?: string };
                Returns: void;
            };
            end_study_session: {
                Args: {
                    p_session_id: string;
                    p_questions_attempted: number;
                    p_questions_correct: number;
                    p_total_time_seconds: number;
                };
                Returns: void;
            };
            increment_daily_usage: {
                Args: Record<string, never>;
                Returns: number;
            };
            increment_pdf_usage: {
                Args: any;
                Returns: number;
            };
            get_specialty_performance_diagnosis: {
                Args: any;
                Returns: Json;
            };
            get_question_metadata_summary: {
                Args: any;
                Returns: Json;
            };
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
    Public: Database['public'];
};
