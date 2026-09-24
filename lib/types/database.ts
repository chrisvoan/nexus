// Hand-written until the schema settles; regenerate with
// `npx supabase gen types typescript --project-id <ref> > lib/types/database.ts`.

export type UserRole = "admin" | "user"
export type AgentSyncStatus = "pending" | "synced" | "error"

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          display_name: string | null
          avatar_url: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          role?: UserRole
          display_name?: string | null
          avatar_url?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          id: boolean
          company_name: string | null
          company_overview: string | null
          brand_voice: string | null
          reusable_instructions: string | null
          pipedream_account_id: string | null
          pipedream_external_user_id: string | null
          pipedream_connected_by: string | null
          pipedream_connected_at: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          company_name?: string | null
          company_overview?: string | null
          brand_voice?: string | null
          reusable_instructions?: string | null
          pipedream_account_id?: string | null
          pipedream_external_user_id?: string | null
          pipedream_connected_by?: string | null
          pipedream_connected_at?: string | null
          updated_by?: string | null
        }
        Update: {
          company_name?: string | null
          company_overview?: string | null
          brand_voice?: string | null
          reusable_instructions?: string | null
          pipedream_account_id?: string | null
          pipedream_external_user_id?: string | null
          pipedream_connected_by?: string | null
          pipedream_connected_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          id: string
          name: string
          description: string | null
          system_prompt: string
          model: string
          claude_agent_id: string | null
          claude_agent_version: number | null
          sync_status: AgentSyncStatus
          sync_error: string | null
          synced_at: string | null
          archived_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          system_prompt?: string
          model: string
          claude_agent_id?: string | null
          claude_agent_version?: number | null
          sync_status?: AgentSyncStatus
          sync_error?: string | null
          synced_at?: string | null
          archived_at?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          system_prompt?: string
          model?: string
          claude_agent_id?: string | null
          claude_agent_version?: number | null
          sync_status?: AgentSyncStatus
          sync_error?: string | null
          synced_at?: string | null
          archived_at?: string | null
        }
        Relationships: []
      }
      agent_knowledge: {
        Row: {
          id: string
          agent_id: string
          file_id: string
          file_name: string
          file_mime_type: string
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          file_id: string
          file_name: string
          file_mime_type: string
          added_by?: string | null
        }
        Update: {
          file_name?: string
          file_mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_agents: {
        Row: {
          user_id: string
          agent_id: string
          custom_instructions: string | null
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          agent_id: string
          custom_instructions?: string | null
          assigned_by?: string | null
        }
        Update: {
          custom_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: UserRole }
    }
    Enums: { user_role: UserRole }
    CompositeTypes: { [_ in never]: never }
  }
}

type Tables = Database["public"]["Tables"]

export type Profile = Tables["profiles"]["Row"]
export type CompanySettings = Tables["company_settings"]["Row"]
export type Agent = Tables["agents"]["Row"]
export type AgentKnowledge = Tables["agent_knowledge"]["Row"]
export type UserAgent = Tables["user_agents"]["Row"]
