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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_label: string | null
          actor_role: string | null
          field: string | null
          id: string
          metadata: Json
          new_status: string | null
          new_value_masked: string | null
          occurred_at: string
          old_value_masked: string | null
          payment_request_id: string | null
          previous_status: string | null
          vendor_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_label?: string | null
          actor_role?: string | null
          field?: string | null
          id?: string
          metadata?: Json
          new_status?: string | null
          new_value_masked?: string | null
          occurred_at?: string
          old_value_masked?: string | null
          payment_request_id?: string | null
          previous_status?: string | null
          vendor_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_label?: string | null
          actor_role?: string | null
          field?: string | null
          id?: string
          metadata?: Json
          new_status?: string | null
          new_value_masked?: string | null
          occurred_at?: string
          old_value_masked?: string | null
          payment_request_id?: string | null
          previous_status?: string | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      bank_directory: {
        Row: {
          bank_address: string | null
          bank_name: string
          country: string
          created_at: string
          id: string
          source: string
          swift_bic: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          bank_address?: string | null
          bank_name: string
          country: string
          created_at?: string
          id?: string
          source?: string
          swift_bic?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          bank_address?: string | null
          bank_name?: string
          country?: string
          created_at?: string
          id?: string
          source?: string
          swift_bic?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      currencies: {
        Row: {
          active: boolean
          code: string
          name: string
          priority: number
        }
        Insert: {
          active?: boolean
          code: string
          name: string
          priority?: number
        }
        Update: {
          active?: boolean
          code?: string
          name?: string
          priority?: number
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          locale: string
          payment_request_id: string | null
          recipient: string
          status: string
          template: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          locale?: string
          payment_request_id?: string | null
          recipient: string
          status?: string
          template: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          locale?: string
          payment_request_id?: string | null
          recipient?: string
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders: {
        Row: {
          channel: string
          id: string
          payment_request_id: string
          recipient: string
          sent_at: string
          sequence_number: number
          status: string
        }
        Insert: {
          channel?: string
          id?: string
          payment_request_id: string
          recipient: string
          sent_at?: string
          sequence_number: number
          status?: string
        }
        Update: {
          channel?: string
          id?: string
          payment_request_id?: string
          recipient?: string
          sent_at?: string
          sequence_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_sync_logs: {
        Row: {
          action: string
          attempts: number
          board_id: string | null
          created_at: string
          entity_type: string
          error: string | null
          id: string
          monday_item_id: string | null
          next_attempt_at: string | null
          payload: Json
          payment_request_id: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          action: string
          attempts?: number
          board_id?: string | null
          created_at?: string
          entity_type?: string
          error?: string | null
          id?: string
          monday_item_id?: string | null
          next_attempt_at?: string | null
          payload?: Json
          payment_request_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          action?: string
          attempts?: number
          board_id?: string | null
          created_at?: string
          entity_type?: string
          error?: string | null
          id?: string
          monday_item_id?: string | null
          next_attempt_at?: string | null
          payload?: Json
          payment_request_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monday_sync_logs_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monday_sync_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          payment_request_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload?: Json
          payment_request_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          payment_request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_approvals: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          id: string
          notes: string | null
          payment_request_id: string
          reason: string | null
        }
        Insert: {
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          notes?: string | null
          payment_request_id: string
          reason?: string | null
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          notes?: string | null
          payment_request_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_approvals_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      payment_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          payment_request_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          payment_request_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          payment_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_comments_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          payment_request_id: string
          storage_path: string
          uploaded_by: string | null
          uploaded_by_vendor: boolean
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          payment_request_id: string
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_vendor?: boolean
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          payment_request_id?: string
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_vendor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_documents_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          currency: string
          description: string
          due_date: string | null
          duplicate_of: string | null
          id: string
          invoice_number: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          monday_item_id: string | null
          monday_sync_status: string
          monday_synced_at: string | null
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_snapshot: Json
          po_reference: string | null
          possible_duplicate: boolean
          rejected_at: string | null
          rejection_reason: string | null
          reminders_paused: boolean
          request_number: string
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string | null
          updated_at: string
          vendor_id: string
          vendor_snapshot: Json
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          currency: string
          description: string
          due_date?: string | null
          duplicate_of?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          monday_item_id?: string | null
          monday_sync_status?: string
          monday_synced_at?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_snapshot?: Json
          po_reference?: string | null
          possible_duplicate?: boolean
          rejected_at?: string | null
          rejection_reason?: string | null
          reminders_paused?: boolean
          request_number?: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          updated_at?: string
          vendor_id: string
          vendor_snapshot?: Json
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string
          due_date?: string | null
          duplicate_of?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          monday_item_id?: string | null
          monday_sync_status?: string
          monday_synced_at?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_snapshot?: Json
          po_reference?: string | null
          possible_duplicate?: boolean
          rejected_at?: string | null
          rejection_reason?: string | null
          reminders_paused?: boolean
          request_number?: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string
          vendor_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_status_history: {
        Row: {
          actor_label: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["payment_status"]
          note: string | null
          payment_request_id: string
          previous_status: Database["public"]["Enums"]["payment_status"] | null
        }
        Insert: {
          actor_label?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["payment_status"]
          note?: string | null
          payment_request_id: string
          previous_status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Update: {
          actor_label?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["payment_status"]
          note?: string | null
          payment_request_id?: string
          previous_status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_status_history_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_paid: number
          created_at: string
          currency_paid: string
          id: string
          notes: string | null
          paid_on: string
          payment_request_id: string
          recorded_by: string
          reference: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          currency_paid: string
          id?: string
          notes?: string | null
          paid_on: string
          payment_request_id: string
          recorded_by: string
          reference: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          currency_paid?: string
          id?: string
          notes?: string | null
          paid_on?: string
          payment_request_id?: string
          recorded_by?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          locale: string
          must_change_password: boolean
          notification_prefs: Json
          password_changed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          locale?: string
          must_change_password?: boolean
          notification_prefs?: Json
          password_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          locale?: string
          must_change_password?: boolean
          notification_prefs?: Json
          password_changed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_form_hits: {
        Row: {
          action: string
          bucket_key: string
          created_at: string
          id: string
        }
        Insert: {
          action: string
          bucket_key: string
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          bucket_key?: string
          created_at?: string
          id?: string
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
      vendor_bank_accounts: {
        Row: {
          account_number: string | null
          bank_address: string | null
          bank_country: string | null
          bank_name: string | null
          beneficiary_address: string | null
          beneficiary_country: string | null
          beneficiary_name: string | null
          branch_number: string | null
          bsb: string | null
          clabe: string | null
          created_at: string
          directory_bank_id: string | null
          entry_source: string
          iban: string | null
          id: string
          instructions: string | null
          intermediary_bank: string | null
          is_active: boolean
          local_clearing_code: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paypal_account_name: string | null
          paypal_email: string | null
          paypal_link: string | null
          pending_review: boolean
          routing_number: string | null
          sort_code: string | null
          swift_bic: string | null
          transit_number: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          account_number?: string | null
          bank_address?: string | null
          bank_country?: string | null
          bank_name?: string | null
          beneficiary_address?: string | null
          beneficiary_country?: string | null
          beneficiary_name?: string | null
          branch_number?: string | null
          bsb?: string | null
          clabe?: string | null
          created_at?: string
          directory_bank_id?: string | null
          entry_source?: string
          iban?: string | null
          id?: string
          instructions?: string | null
          intermediary_bank?: string | null
          is_active?: boolean
          local_clearing_code?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paypal_account_name?: string | null
          paypal_email?: string | null
          paypal_link?: string | null
          pending_review?: boolean
          routing_number?: string | null
          sort_code?: string | null
          swift_bic?: string | null
          transit_number?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          account_number?: string | null
          bank_address?: string | null
          bank_country?: string | null
          bank_name?: string | null
          beneficiary_address?: string | null
          beneficiary_country?: string | null
          beneficiary_name?: string | null
          branch_number?: string | null
          bsb?: string | null
          clabe?: string | null
          created_at?: string
          directory_bank_id?: string | null
          entry_source?: string
          iban?: string | null
          id?: string
          instructions?: string | null
          intermediary_bank?: string | null
          is_active?: boolean
          local_clearing_code?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paypal_account_name?: string | null
          paypal_email?: string | null
          paypal_link?: string | null
          pending_review?: boolean
          routing_number?: string | null
          sort_code?: string | null
          swift_bic?: string | null
          transit_number?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bank_accounts_directory_bank_id_fkey"
            columns: ["directory_bank_id"]
            isOneToOne: false
            referencedRelation: "bank_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bank_accounts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_detail_changes: {
        Row: {
          created_at: string
          field: string
          id: string
          new_masked: string | null
          old_masked: string | null
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          new_masked?: string | null
          old_masked?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          new_masked?: string | null
          old_masked?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_detail_changes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payment_request_id: string | null
          purpose: Database["public"]["Enums"]["vendor_link_purpose"]
          revoked: boolean
          token_hash: string
          used_at: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          payment_request_id?: string | null
          purpose: Database["public"]["Enums"]["vendor_link_purpose"]
          revoked?: boolean
          token_hash: string
          used_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payment_request_id?: string | null
          purpose?: Database["public"]["Enums"]["vendor_link_purpose"]
          revoked?: boolean
          token_hash?: string
          used_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_links_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_links_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_line: string | null
          beneficiary_name: string
          city: string | null
          contact_first_name: string | null
          contact_last_name: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          internal_notes: string | null
          is_favorite: boolean
          monday_contact_id: string | null
          monday_synced_at: string | null
          payment_details_changed: boolean
          payment_details_changed_at: string | null
          phone: string | null
          postal_code: string | null
          preferred_currency: string | null
          preferred_payment_method:
            | Database["public"]["Enums"]["payment_method"]
            | null
          registration_number: string | null
          state_province: string | null
          tax_id: string | null
          updated_at: string
          vendor_name: string
        }
        Insert: {
          address_line?: string | null
          beneficiary_name: string
          city?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          internal_notes?: string | null
          is_favorite?: boolean
          monday_contact_id?: string | null
          monday_synced_at?: string | null
          payment_details_changed?: boolean
          payment_details_changed_at?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_currency?: string | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          registration_number?: string | null
          state_province?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_name: string
        }
        Update: {
          address_line?: string | null
          beneficiary_name?: string
          city?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          internal_notes?: string | null
          is_favorite?: boolean
          monday_contact_id?: string | null
          monday_synced_at?: string | null
          payment_details_changed?: boolean
          payment_details_changed_at?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_currency?: string | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          registration_number?: string | null
          state_province?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      next_payment_request_number: { Args: never; Returns: string }
      write_audit: {
        Args: {
          _action: string
          _field?: string
          _metadata?: Json
          _new_masked?: string
          _new_status?: string
          _old_masked?: string
          _payment_request_id?: string
          _previous_status?: string
          _vendor_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "approver"
        | "payment_manager"
        | "accounting"
        | "viewer"
      invoice_status: "attached" | "pending" | "received"
      payment_method: "paypal" | "bank_transfer"
      payment_status:
        | "draft"
        | "submitted"
        | "awaiting_approval"
        | "approved"
        | "rejected"
        | "awaiting_payment"
        | "paid"
        | "awaiting_invoice"
        | "completed"
        | "cancelled"
      vendor_link_purpose: "payment_request" | "invoice_upload"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "approver",
        "payment_manager",
        "accounting",
        "viewer",
      ],
      invoice_status: ["attached", "pending", "received"],
      payment_method: ["paypal", "bank_transfer"],
      payment_status: [
        "draft",
        "submitted",
        "awaiting_approval",
        "approved",
        "rejected",
        "awaiting_payment",
        "paid",
        "awaiting_invoice",
        "completed",
        "cancelled",
      ],
      vendor_link_purpose: ["payment_request", "invoice_upload"],
    },
  },
} as const
