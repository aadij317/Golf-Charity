// Generated to match supabase/migrations/0001_init_schema.sql (locked
// schema — do not edit that file, add a new numbered migration instead).
// If the schema changes, regenerate this by hand from the new migration
// rather than editing types here without a matching SQL change.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          role: "subscriber" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          role?: "subscriber" | "admin";
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string;
          role?: "subscriber" | "admin";
          created_at?: string;
        };
        Relationships: [];
      };
      charities: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          is_featured: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          is_featured?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          is_featured?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: "monthly" | "yearly";
          status: "active" | "cancelled" | "lapsed";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          charity_id: string | null;
          charity_contribution_pct: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan: "monthly" | "yearly";
          status?: "active" | "cancelled" | "lapsed";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          charity_id?: string | null;
          charity_contribution_pct?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: "monthly" | "yearly";
          status?: "active" | "cancelled" | "lapsed";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          charity_id?: string | null;
          charity_contribution_pct?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          }
        ];
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          score: number;
          score_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score: number;
          score_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score?: number;
          score_date?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      draws: {
        Row: {
          id: string;
          month: string;
          status: "draft" | "simulated" | "published";
          draw_type: "random" | "algorithmic";
          winning_numbers: number[];
          jackpot_rollover_amount: number;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          month: string;
          status?: "draft" | "simulated" | "published";
          draw_type: "random" | "algorithmic";
          winning_numbers?: number[];
          jackpot_rollover_amount?: number;
          created_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          month?: string;
          status?: "draft" | "simulated" | "published";
          draw_type?: "random" | "algorithmic";
          winning_numbers?: number[];
          jackpot_rollover_amount?: number;
          created_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      draw_entries: {
        Row: {
          id: string;
          draw_id: string;
          user_id: string;
          matched_tier: "5" | "4" | "3" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          draw_id: string;
          user_id: string;
          matched_tier?: "5" | "4" | "3" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          draw_id?: string;
          user_id?: string;
          matched_tier?: "5" | "4" | "3" | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "draw_entries_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draw_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      winners: {
        Row: {
          id: string;
          draw_id: string;
          user_id: string;
          tier: "5" | "4" | "3";
          prize_amount: number;
          proof_url: string | null;
          verification_status: "pending" | "approved" | "rejected";
          payment_status: "pending" | "paid";
          created_at: string;
        };
        Insert: {
          id?: string;
          draw_id: string;
          user_id: string;
          tier: "5" | "4" | "3";
          prize_amount: number;
          proof_url?: string | null;
          verification_status?: "pending" | "approved" | "rejected";
          payment_status?: "pending" | "paid";
          created_at?: string;
        };
        Update: {
          id?: string;
          draw_id?: string;
          user_id?: string;
          tier?: "5" | "4" | "3";
          prize_amount?: number;
          proof_url?: string | null;
          verification_status?: "pending" | "approved" | "rejected";
          payment_status?: "pending" | "paid";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "winners_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "winners_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      donations: {
        Row: {
          id: string;
          user_id: string;
          charity_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          charity_id: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          charity_id?: string;
          amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "donations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "donations_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
