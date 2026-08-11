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
      agent_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          company: string | null
          created_at: string
          field_label: string
          field_type: string
          id: string
          job_title: string | null
          options: Json
          run_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          company?: string | null
          created_at?: string
          field_label: string
          field_type?: string
          id?: string
          job_title?: string | null
          options?: Json
          run_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          company?: string | null
          created_at?: string
          field_label?: string
          field_type?: string
          id?: string
          job_title?: string | null
          options?: Json
          run_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_run_steps: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          idx: number
          logs: string | null
          name: string
          run_id: string
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          idx?: number
          logs?: string | null
          name: string
          run_id: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          idx?: number
          logs?: string | null
          name?: string
          run_id?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          company: string | null
          created_at: string
          current_step: string | null
          id: string
          job_title: string | null
          job_url: string | null
          mode: string
          outcome: string | null
          progress: number
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          current_step?: string | null
          id?: string
          job_title?: string | null
          job_url?: string | null
          mode?: string
          outcome?: string | null
          progress?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          current_step?: string | null
          id?: string
          job_title?: string | null
          job_url?: string | null
          mode?: string
          outcome?: string | null
          progress?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_approvals: {
        Row: {
          approved_at: string | null
          company: string | null
          created_at: string
          decision: string
          id: string
          job_title: string | null
          job_url: string | null
          resume_preview: string | null
          resume_sha256: string
          run_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          company?: string | null
          created_at?: string
          decision?: string
          id?: string
          job_title?: string | null
          job_url?: string | null
          resume_preview?: string | null
          resume_sha256: string
          run_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          company?: string | null
          created_at?: string
          decision?: string
          id?: string
          job_title?: string | null
          job_url?: string | null
          resume_preview?: string | null
          resume_sha256?: string
          run_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          last_attempt_at: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          last_attempt_at?: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          last_attempt_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          category: string
          content: string
          created_at: string | null
          excerpt: string
          featured_image: string | null
          id: string
          is_featured: boolean | null
          is_success_story: boolean | null
          outcomes: Json | null
          prompts_used: Json | null
          published_at: string | null
          read_time_minutes: number | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_name?: string | null
          category: string
          content: string
          created_at?: string | null
          excerpt: string
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          is_success_story?: boolean | null
          outcomes?: Json | null
          prompts_used?: Json | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_name?: string | null
          category?: string
          content?: string
          created_at?: string | null
          excerpt?: string
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          is_success_story?: boolean | null
          outcomes?: Json | null
          prompts_used?: Json | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          notes: string | null
          relationship: string
          source: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          notes?: string | null
          relationship?: string
          source?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          relationship?: string
          source?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_sessions: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          role: string
          score: number | null
          transcript: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          id?: string
          role: string
          score?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          role?: string
          score?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          body: string
          channel: string
          contact_id: string | null
          created_at: string
          id: string
          kind: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_events: {
        Row: {
          created_at: string
          event: string
          id: string
          metadata: Json
          route: string | null
          tab: string | null
          target: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          route?: string | null
          tab?: string | null
          target?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          route?: string | null
          tab?: string | null
          target?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pet_preferences: {
        Row: {
          created_at: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      resume_analyses: {
        Row: {
          analysis_data: Json
          company_name: string | null
          created_at: string
          id: string
          job_description: string | null
          job_title: string | null
          overall_score: number
          parsed_resume: Json | null
          resume_filename: string
          resume_text: string | null
          user_id: string
        }
        Insert: {
          analysis_data: Json
          company_name?: string | null
          created_at?: string
          id?: string
          job_description?: string | null
          job_title?: string | null
          overall_score: number
          parsed_resume?: Json | null
          resume_filename: string
          resume_text?: string | null
          user_id: string
        }
        Update: {
          analysis_data?: Json
          company_name?: string | null
          created_at?: string
          id?: string
          job_description?: string | null
          job_title?: string | null
          overall_score?: number
          parsed_resume?: Json | null
          resume_filename?: string
          resume_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roadmap_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          roadmap_slug: string
          status: string
          step_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          roadmap_slug: string
          status?: string
          step_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          roadmap_slug?: string
          status?: string
          step_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      route_views: {
        Row: {
          created_at: string
          id: string
          referrer: string | null
          route: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referrer?: string | null
          route: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referrer?: string | null
          route?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          company: string
          created_at: string
          id: string
          location: string | null
          notes: string | null
          saved_at: string
          stage: Database["public"]["Enums"]["pipeline_stage"]
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          saved_at?: string
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          saved_at?: string
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alert_enabled: boolean
          created_at: string
          id: string
          location: string | null
          min_score: number
          name: string
          query: string
          remote_only: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_enabled?: boolean
          created_at?: string
          id?: string
          location?: string | null
          min_score?: number
          name: string
          query?: string
          remote_only?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_enabled?: boolean
          created_at?: string
          id?: string
          location?: string | null
          min_score?: number
          name?: string
          query?: string
          remote_only?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      submission_receipts: {
        Row: {
          answers: Json
          application_id: string | null
          ats_vendor: string | null
          company: string | null
          confirmation_number: string | null
          confirmation_text: string | null
          created_at: string
          id: string
          job_title: string | null
          job_url: string | null
          outcome: string
          run_id: string | null
          screenshot_path: string | null
          submitted_at: string | null
          submitted_resume_sha256: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          answers?: Json
          application_id?: string | null
          ats_vendor?: string | null
          company?: string | null
          confirmation_number?: string | null
          confirmation_text?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          job_url?: string | null
          outcome?: string
          run_id?: string | null
          screenshot_path?: string | null
          submitted_at?: string | null
          submitted_resume_sha256?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          answers?: Json
          application_id?: string | null
          ats_vendor?: string | null
          company?: string | null
          confirmation_number?: string | null
          confirmation_text?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          job_url?: string | null
          outcome?: string
          run_id?: string | null
          screenshot_path?: string | null
          submitted_at?: string | null
          submitted_resume_sha256?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achieved_at: string | null
          achievement_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          achievement_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          achievement_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_streak: number | null
          last_activity_date: string | null
          longest_streak: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          last_activity_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          last_activity_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_auth_attempts: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      pipeline_stage: "saved" | "applied" | "interview" | "offer" | "rejected"
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
      app_role: ["admin", "moderator", "user"],
      pipeline_stage: ["saved", "applied", "interview", "offer", "rejected"],
    },
  },
} as const
