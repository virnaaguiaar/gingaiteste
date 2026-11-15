// Gerado a partir do schema Supabase (supabase gen types typescript).
// Regenerar após mudanças no banco. Não editar à mão.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      collection_recordings: {
        Row: {
          client_id: string | null
          created_at: string
          duration_s: number
          id: string
          label: string
          user_id: string
          windows: Json
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration_s?: number
          id?: string
          label: string
          user_id: string
          windows?: Json
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration_s?: number
          id?: string
          label?: string
          user_id?: string
          windows?: Json
        }
        Relationships: []
      }
      dance_styles_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          emoji: string
          is_control: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          is_control?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          is_control?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          code: string
          created_at: string
          name: string
          owner_id: string | null
          style: string | null
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          owner_id?: string | null
          style?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          owner_id?: string | null
          style?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: []
      }
      global_models: {
        Row: {
          id: number
          model: Json
          updated_at: string
          users_count: number
          windows_count: number
        }
        Insert: {
          id?: number
          model: Json
          updated_at?: string
          users_count?: number
          windows_count?: number
        }
        Update: {
          id?: number
          model?: Json
          updated_at?: string
          users_count?: number
          windows_count?: number
        }
        Relationships: []
      }
      participant_scores: {
        Row: {
          avatar_url: string | null
          current_style: string | null
          dance_seconds: number
          event_code: string
          nickname: string
          participant_id: string
          points: number
          simulated: boolean
          top_style: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          current_style?: string | null
          dance_seconds?: number
          event_code: string
          nickname: string
          participant_id: string
          points?: number
          simulated?: boolean
          top_style?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          current_style?: string | null
          dance_seconds?: number
          event_code?: string
          nickname?: string
          participant_id?: string
          points?: number
          simulated?: boolean
          top_style?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_scores_event_code_fkey"
            columns: ["event_code"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nickname: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nickname?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          dance_seconds: number
          ended_at: string
          id: string
          max_combo: number
          points: number
          started_at: string
          style_seconds: Json
          top_style: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dance_seconds?: number
          ended_at: string
          id?: string
          max_combo?: number
          points?: number
          started_at: string
          style_seconds?: Json
          top_style?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dance_seconds?: number
          ended_at?: string
          id?: string
          max_combo?: number
          points?: number
          started_at?: string
          style_seconds?: Json
          top_style?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trained_models: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          model: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          model: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          model?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      event_visibility: "public" | "private"
      user_role: "user" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
