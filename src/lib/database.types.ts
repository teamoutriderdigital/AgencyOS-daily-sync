export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ─── Enums (mirror the GrowthArchon L10 module) ─────────────────────────────
export type TeamMember = "Jack" | "Daniel" | "Leonardo" | "Rehan" | "Kas";
export type L10Priority = "High" | "Medium" | "Low";
export type IdsStatus = "Not started" | "Block" | "In progress" | "Solved";

export interface Database {
  public: {
    Tables: {
      // To-dos. Standalone copy of the L10 action_items table.
      action_items: {
        Row: {
          id: number;
          item: string;
          assignee: TeamMember | null;
          due_date: string | null;
          priority: L10Priority | null;
          done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["action_items"]["Row"]> & {
          item: string;
        };
        Update: Partial<Database["public"]["Tables"]["action_items"]["Row"]>;
        Relationships: [];
      };
      // Issues (IDS). Standalone copy of the L10 ids_items table.
      ids_items: {
        Row: {
          id: number;
          issue: string;
          owner: TeamMember | null;
          status: IdsStatus;
          priority: L10Priority | null;
          client_internal: string[];
          due_date: string | null;
          identify: string | null;
          discuss: string | null;
          solve: string | null;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ids_items"]["Row"]> & {
          issue: string;
        };
        Update: Partial<Database["public"]["Tables"]["ids_items"]["Row"]>;
        Relationships: [];
      };
      // Daily-specific: one one-line check-in per (date, member).
      daily_checkins: {
        Row: {
          id: number;
          checkin_date: string;
          member: TeamMember;
          mood: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_checkins"]["Row"]> & {
          checkin_date: string;
          member: TeamMember;
        };
        Update: Partial<Database["public"]["Tables"]["daily_checkins"]["Row"]>;
        Relationships: [];
      };
      // Daily-specific: client headlines (one-line news) for a given day.
      daily_headlines: {
        Row: {
          id: number;
          headline_date: string;
          client: string | null;
          text: string;
          created_by: TeamMember | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_headlines"]["Row"]> & {
          headline_date: string;
          text: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_headlines"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
