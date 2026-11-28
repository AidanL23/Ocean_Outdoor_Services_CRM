export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          author: string | null
          client_id: string | null
          contact_date: string
          content: string
          created_at: string | null
          id: string
          job_id: string | null
        }
        Insert: {
          author?: string | null
          client_id?: string | null
          contact_date?: string
          content: string
          created_at?: string | null
          id?: string
          job_id?: string | null
        }
        Update: {
          author?: string | null
          client_id?: string | null
          contact_date?: string
          content?: string
          created_at?: string | null
          id?: string
          job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_schedule_parts: {
        Row: {
          agreement_id: string
          created_at: string
          end_date: string
          id: string
          interval_weeks: number
          price_per_visit: number
          sort_order: number
          start_date: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          end_date: string
          id?: string
          interval_weeks: number
          price_per_visit: number
          sort_order?: number
          start_date: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          end_date?: string
          id?: string
          interval_weeks?: number
          price_per_visit?: number
          sort_order?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_schedule_parts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "service_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_tasks: {
        Row: {
          agreement_id: string
          task_id: string
        }
        Insert: {
          agreement_id: string
          task_id: string
        }
        Update: {
          agreement_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_tasks_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "service_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "service_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_visits: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
          price: number
          schedule_part_id: string | null
          visit_date: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
          price: number
          schedule_part_id?: string | null
          visit_date: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
          price?: number
          schedule_part_id?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_visits_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "service_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_visits_schedule_part_id_fkey"
            columns: ["schedule_part_id"]
            isOneToOne: false
            referencedRelation: "agreement_schedule_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          last_contact_green_days: number
          last_contact_yellow_days: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          last_contact_green_days?: number
          last_contact_yellow_days?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          last_contact_green_days?: number
          last_contact_yellow_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          action: string | null
          created_at: string
          description: string
          discount_pct: number
          id: string
          invoice_id: string
          line_date: string | null
          qty: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          action?: string | null
          created_at?: string
          description: string
          discount_pct?: number
          id?: string
          invoice_id: string
          line_date?: string | null
          qty?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          action?: string | null
          created_at?: string
          description?: string
          discount_pct?: number
          id?: string
          invoice_id?: string
          line_date?: string | null
          qty?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: number
          job_id: string | null
          message: string | null
          status: string
          tax_rate: number
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: never
          job_id?: string | null
          message?: string | null
          status?: string
          tax_rate?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: never
          job_id?: string | null
          message?: string | null
          status?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          property_id: string | null
          scope_of_work: string | null
          status: string | null
          title: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          scope_of_work?: string | null
          status?: string | null
          title: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          scope_of_work?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          client_id: string | null
          created_at: string | null
          id: string
          site_instructions: string | null
        }
        Insert: {
          address: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          site_instructions?: string | null
        }
        Update: {
          address?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          site_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agreements: {
        Row: {
          billing_months: number | null
          billing_type: string
          client_id: string
          created_at: string
          end_date: string
          id: string
          monthly_price: number | null
          notes: string | null
          price_per_visit: number | null
          property_id: string | null
          renewed_from_id: string | null
          service_areas: string | null
          service_type_id: string
          start_date: string
          status: string
        }
        Insert: {
          billing_months?: number | null
          billing_type: string
          client_id: string
          created_at?: string
          end_date: string
          id?: string
          monthly_price?: number | null
          notes?: string | null
          price_per_visit?: number | null
          property_id?: string | null
          renewed_from_id?: string | null
          service_areas?: string | null
          service_type_id: string
          start_date: string
          status?: string
        }
        Update: {
          billing_months?: number | null
          billing_type?: string
          client_id?: string
          created_at?: string
          end_date?: string
          id?: string
          monthly_price?: number | null
          notes?: string | null
          price_per_visit?: number | null
          property_id?: string | null
          renewed_from_id?: string | null
          service_areas?: string | null
          service_type_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agreements_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "service_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agreements_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tasks: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      service_types: {
        Row: {
          active: boolean
          created_at: string
          default_end_month: number | null
          default_start_month: number | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_end_month?: number | null
          default_start_month?: number | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          default_end_month?: number | null
          default_start_month?: number | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      client_last_contact: {
        Row: {
          client_id: string
          last_contact_at: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      save_service_agreement: {
        Args: {
          p_agreement: Json
          p_id: string | null
          p_parts: Json
          p_task_ids: string[]
          p_visits: Json
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
