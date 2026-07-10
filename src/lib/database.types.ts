export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ─── Enums (mirror the GrowthArchon L10 module) ─────────────────────────────
export type TeamMember = "Jack" | "Daniel" | "Leonardo" | "Rehan" | "Kas" | "Mostafa";
export type L10Priority = "High" | "Medium" | "Low";
export type IdsStatus = "Not started" | "Block" | "In progress" | "Solved";
export type AttendanceStatus = "Present" | "Out";
export type RockType = "company" | "individual";
export type RockStatus = "On track" | "Off track" | "Done";
export type ClientStage = "Onboarding" | "Active" | "At Risk" | "Delivered" | "Churned";

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
          // Weekly view: ISO week the item belongs to (auto-stamped on insert),
          // and the week it was carried forward from (set by the carryover engine).
          week_number: number | null;
          year_number: number | null;
          carried_from_week: number | null;
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
          // Weekly view: upvotes (topics/issues sort by votes first) + ISO week
          // tracking and the carried-forward-from week (see 004 migration).
          upvotes: number;
          week_number: number | null;
          year_number: number | null;
          carried_from_week: number | null;
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
          status: AttendanceStatus | null;
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
      // Daily-specific: "items to review for the day" — a per-day checklist.
      daily_review_items: {
        Row: {
          id: number;
          review_date: string;
          text: string;
          done: boolean;
          created_by: TeamMember | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_review_items"]["Row"]> & {
          review_date: string;
          text: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_review_items"]["Row"]>;
        Relationships: [];
      };
      // Rocks meeting: the finalized deliverable. One rock per row. `owner` is
      // free text (rocks roster is wider than the team_member enum).
      rocks: {
        Row: {
          id: number;
          title: string;
          owner: string | null;
          rock_type: RockType;
          smart: string | null;
          deadline: string | null;
          sort_order: number;
          // Weekly tracker: reviewed status + which quarter the rock belongs to.
          status: RockStatus;
          quarter: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rocks"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["rocks"]["Row"]>;
        Relationships: [];
      };
      // Client lifecycle tracker (weekly board) + client picker for /submit.
      clients: {
        Row: {
          id: number;
          name: string;
          stage: ClientStage;
          owner: string | null;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [];
      };
      // Rocks meeting: keyed store for the decisions, collision resolutions,
      // exit checklist, and facilitator. text_value = written call; checked =
      // locked / done.
      rock_meeting_kv: {
        Row: {
          key: string;
          text_value: string | null;
          checked: boolean;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rock_meeting_kv"]["Row"]> & {
          key: string;
        };
        Update: Partial<Database["public"]["Tables"]["rock_meeting_kv"]["Row"]>;
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
