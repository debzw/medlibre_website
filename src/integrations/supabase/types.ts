import { Question, UserProfile, QuestionHistoryEntry, UserSpacedRepetition, UserThemeStats, Report } from '../../types/database';

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            questions: {
                Row: Question;
                Insert: Partial<Question>;
                Update: Partial<Question>;
                Relationships: [];
            };
            user_profiles: {
                Row: UserProfile;
                Insert: Partial<UserProfile>;
                Update: Partial<UserProfile>;
                Relationships: [];
            };
            user_question_history: {
                Row: QuestionHistoryEntry;
                Insert: Partial<QuestionHistoryEntry>;
                Update: Partial<QuestionHistoryEntry>;
                Relationships: [
                    {
                        foreignKeyName: "user_question_history_question_id_fkey"
                        columns: ["question_id"]
                        isOneToOne: false
                        referencedRelation: "questions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "user_question_history_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "user_profiles"
                        referencedColumns: ["id"]
                    }
                ];
            };
            user_spaced_repetition: {
                Row: UserSpacedRepetition;
                Insert: Partial<UserSpacedRepetition>;
                Update: Partial<UserSpacedRepetition>;
                Relationships: [];
            };
            user_theme_stats: {
                Row: UserThemeStats;
                Insert: Partial<UserThemeStats>;
                Update: Partial<UserThemeStats>;
                Relationships: [];
            };
            reports: {
                Row: Report;
                Insert: Partial<Report>;
                Update: Partial<Report>;
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            get_study_session_questions: {
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
                Returns: Question[];
            };
            get_user_stats: {
                Args: {
                    p_user_id: string;
                    p_time_filter?: string;
                };
                Returns: any;
            };
            increment_daily_usage: {
                Args: Record<PropertyKey, never>;
                Returns: number;
            };
            increment_pdf_usage: {
                Args: Record<PropertyKey, never>;
                Returns: number;
            };
            get_specialty_performance_diagnosis: {
                Args: {
                    p_user_id: string;
                    p_specialty: string;
                };
                Returns: any;
            };
            get_question_metadata_summary: {
                Args: Record<PropertyKey, never>;
                Returns: any;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
