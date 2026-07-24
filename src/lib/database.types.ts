export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ─── Enums (mirror the GrowthArchon L10 module) ─────────────────────────────
export type TeamMember = "Jack" | "Daniel" | "Leonardo" | "Rehan" | "Kas" | "Mostafa";
export type L10Priority = "High" | "Medium" | "Low";
export type IdsStatus = "Not started" | "Block" | "In progress" | "Solved";
export type AttendanceStatus = "Present" | "Out";
export type RockType = "company" | "individual";
export type RockStatus = "On track" | "Off track" | "Done";
export type Department = "Admin" | "Growth" | "Internal";
export type BacklogSource = "manual" | "fathom";
export type ClientStage = "Onboarding" | "Active" | "At Risk" | "Delivered" | "Churned";
export type SalesStage = "Lead" | "Proposal" | "Verbal" | "Won" | "Lost";
export type OpsStatus = "Open" | "In progress" | "Blocked" | "Done";

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
          department: Department | null;
          completed_at: string | null;
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
          department: Department | null;
          rock_id: number | null;
          completed_at: string | null;
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
          owner: TeamMember | null;
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
      // Daily-specific: per-bullet tasks under a client headline, each with an
      // optional owner. Denormalized headline_date for date-scoped queries.
      headline_tasks: {
        Row: {
          id: number;
          headline_id: number;
          headline_date: string;
          text: string;
          owner: TeamMember | null;
          done: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["headline_tasks"]["Row"]> & {
          headline_id: number;
          headline_date: string;
          text: string;
        };
        Update: Partial<Database["public"]["Tables"]["headline_tasks"]["Row"]>;
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
      // Daily-specific: meeting rating 1–10, one row per (day, member).
      meeting_ratings: {
        Row: {
          id: number;
          rating_date: string;
          member: TeamMember;
          rating: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meeting_ratings"]["Row"]> & {
          rating_date: string;
          member: TeamMember;
          rating: number;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_ratings"]["Row"]>;
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
          department: Department | null;
          progress_note: string | null;
          completed_at: string | null;
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
      innovations: {
        Row: {
          id: number;
          title: string;
          url: string | null;
          found_by: string | null;
          note: string | null;
          department: Department | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["innovations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["innovations"]["Row"]>;
        Relationships: [];
      };
      backlog_items: {
        Row: {
          id: number;
          title: string;
          detail: string | null;
          department: Department | null;
          source: BacklogSource;
          source_ref: string | null;
          reviewed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["backlog_items"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["backlog_items"]["Row"]>;
        Relationships: [];
      };
      item_summaries: {
        Row: {
          id: number;
          item_type: string;
          item_id: number;
          week_number: number;
          year_number: number;
          summary: string;
          source_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["item_summaries"]["Row"]> & {
          item_type: string;
          item_id: number;
          week_number: number;
          year_number: number;
          summary: string;
        };
        Update: Partial<Database["public"]["Tables"]["item_summaries"]["Row"]>;
        Relationships: [];
      };
      // Sales pipeline — deals we're about to do. Master (not date-scoped).
      sales_deals: {
        Row: {
          id: number;
          name: string;
          value: number | null;
          stage: SalesStage;
          owner: TeamMember | null;
          expected_close: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sales_deals"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["sales_deals"]["Row"]>;
        Relationships: [];
      };
      // Ops task list — title + owner + status. Master (not date-scoped).
      ops_tasks: {
        Row: {
          id: number;
          title: string;
          owner: TeamMember | null;
          status: OpsStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ops_tasks"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ops_tasks"]["Row"]>;
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
