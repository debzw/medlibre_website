export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      questions: {
        Row: {
          id: string
          banca: string
          ano: number
          enunciado: string
          imagem_url: string | null
          opcoes: Json
          resposta_correta: number
          status_imagem: number | null
          referencia_imagem: string | null
          alternativa_a: string | null
          alternativa_b: string | null
          alternativa_c: string | null
          alternativa_d: string | null
          alternativa_e: string | null
          especialidade: string | null
          output_gabarito: string | null
          output_explicacao: string | null
          output_grande_area: string | null
          output_especialidade: string | null
          output_tema: string | null
          output_subtema: string | null
          output_taxa_certeza: number | null
          processado: number | null
          created_at: string
          id_integracao: number | null
        }
        Insert: {
          id?: string
          banca: string
          ano: number
          enunciado: string
          imagem_url?: string | null
          opcoes: Json
          resposta_correta: number
          status_imagem?: number | null
          referencia_imagem?: string | null
          alternativa_a?: string | null
          alternativa_b?: string | null
          alternativa_c?: string | null
          alternativa_d?: string | null
          alternativa_e?: string | null
          especialidade?: string | null
          output_gabarito?: string | null
          output_explicacao?: string | null
          output_grande_area?: string | null
          output_especialidade?: string | null
          output_tema?: string | null
          output_subtema?: string | null
          output_taxa_certeza?: number | null
          processado?: number | null
          created_at?: string
          id_integracao?: number | null
        }
        Update: {
          id?: string
          banca?: string
          ano?: number
          enunciado?: string
          imagem_url?: string | null
          opcoes?: Json
          resposta_correta?: number
          status_imagem?: number | null
          referencia_imagem?: string | null
          alternativa_a?: string | null
          alternativa_b?: string | null
          alternativa_c?: string | null
          alternativa_d?: string | null
          alternativa_e?: string | null
          especialidade?: string | null
          output_gabarito?: string | null
          output_explicacao?: string | null
          output_grande_area?: string | null
          output_especialidade?: string | null
          output_tema?: string | null
          output_subtema?: string | null
          output_taxa_certeza?: number | null
          processado?: number | null
          created_at?: string
          id_integracao?: number | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          last_reset_date: string
          questions_answered_today: number
          theme_preference: string | null
          tier: Database["public"]["Enums"]["user_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          last_reset_date?: string
          questions_answered_today?: number
          theme_preference?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_reset_date?: string
          questions_answered_today?: number
          theme_preference?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      user_question_history: {
        Row: {
          answered_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: number
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: number
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          answered_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: number
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          status: string | null
          target_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          target_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          target_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_spaced_repetition: {
        Row: {
          created_at: string | null
          ease_factor: number | null
          id: string
          interval: number | null
          last_reviewed: string | null
          next_review: string | null
          question_id: string | null
          streak: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          ease_factor?: number | null
          id?: string
          interval?: number | null
          last_reviewed?: string | null
          next_review?: string | null
          question_id?: string | null
          streak?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          ease_factor?: number | null
          id?: string
          interval?: number | null
          last_reviewed?: string | null
          next_review?: string | null
          question_id?: string | null
          streak?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_spaced_repetition_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_theme_stats: {
        Row: {
          id: string
          last_updated: string | null
          mastery_score: number | null
          theme_name: string
          total_answered: number | null
          total_correct: number | null
          user_id: string
        }
        Insert: {
          id?: string
          last_updated?: string | null
          mastery_score?: number | null
          theme_name: string
          total_answered?: number | null
          total_correct?: number | null
          user_id: string
        }
        Update: {
          id?: string
          last_updated?: string | null
          mastery_score?: number | null
          theme_name?: string
          total_answered?: number | null
          total_correct?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_study_session_questions: {
        Args: {
          p_user_id: string
          p_limit?: number
          p_hide_answered?: boolean
        }
        Returns: Database["public"]["Tables"]["questions"]["Row"][]
      }
      increment_daily_usage: {
        Args: Record<string, never>
        Returns: number
      }
      get_user_stats: {
        Args: {
          p_user_id: string
          p_time_filter?: string
        }
        Returns: Json
      }
    }
    Enums: {
      user_tier: "free" | "paid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      user_tier: ["free", "paid"],
    },
  },
} as const
