export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      balance_events: {
        Row: {
          balance: number
          created_at: string
          customer_id: string
          delta: number
          id: number
          processed_at: string | null
        }
        ComputedFields: never
        Insert: {
          balance: number
          created_at?: string
          customer_id: string
          delta: number
          id?: never
          processed_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          customer_id?: string
          delta?: number
          id?: never
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'balance_events_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      claims: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          points: number
          reject_reason: string | null
          sale_at: string | null
          sale_total_cents: number | null
          sale_uuid: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          points?: number
          reject_reason?: string | null
          sale_at?: string | null
          sale_total_cents?: number | null
          sale_uuid: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          points?: number
          reject_reason?: string | null
          sale_at?: string | null
          sale_total_cents?: number | null
          sale_uuid?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'claims_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      dev_mock_sales: {
        Row: {
          channel: string
          sold_at: string
          total_cents: number
          uuid: string
          visible_from: string
          voided: boolean
        }
        ComputedFields: never
        Insert: {
          channel?: string
          sold_at?: string
          total_cents: number
          uuid?: string
          visible_from?: string
          voided?: boolean
        }
        Update: {
          channel?: string
          sold_at?: string
          total_cents?: number
          uuid?: string
          visible_from?: string
          voided?: boolean
        }
        Relationships: []
      }
      game_plays: {
        Row: {
          created_at: string
          customer_id: string
          game: string
          id: string
          points: number
          ref_id: string | null
          result: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          customer_id: string
          game: string
          id?: string
          points?: number
          ref_id?: string | null
          result?: NonNullable<Json>
        }
        Update: {
          created_at?: string
          customer_id?: string
          game?: string
          id?: string
          points?: number
          ref_id?: string | null
          result?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: 'game_plays_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      point_movements: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          kind: string
          points: number
          ref_id: string | null
          ref_table: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          kind: string
          points: number
          ref_id?: string | null
          ref_table?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          points?: number
          ref_id?: string | null
          ref_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'point_movements_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          program_consent_at: string | null
          promo_consent: boolean
          promo_consent_at: string | null
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          program_consent_at?: string | null
          promo_consent?: boolean
          promo_consent_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          program_consent_at?: string | null
          promo_consent?: boolean
          promo_consent_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          customer_id: string
          hits: number
          window_start: string
        }
        ComputedFields: never
        Insert: {
          action: string
          customer_id: string
          hits?: number
          window_start: string
        }
        Update: {
          action?: string
          customer_id?: string
          hits?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rate_limits_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      redemptions: {
        Row: {
          code: string
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          points_spent: number
          reward_id: string
          status: string
          used_at: string | null
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          points_spent?: number
          reward_id: string
          status?: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          points_spent?: number
          reward_id?: string
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'redemptions_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'redemptions_reward_id_fkey'
            columns: ['reward_id']
            isOneToOne: false
            referencedRelation: 'rewards'
            referencedColumns: ['id']
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          description: string
          id: string
          image_url: string | null
          kind: string
          name: string
          sort_order: number
          threshold: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          description?: string
          id?: string
          image_url?: string | null
          kind: string
          name: string
          sort_order?: number
          threshold: number
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          image_url?: string | null
          kind?: string
          name?: string
          sort_order?: number
          threshold?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          is_public: boolean
          key: string
          value: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          is_public?: boolean
          key: string
          value: NonNullable<Json>
        }
        Update: {
          is_public?: boolean
          key?: string
          value?: NonNullable<Json>
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_sale_apply: {
        Args: { p_customer: string; p_sale: Json; p_sale_uuid: string }
        Returns: Json
      }
      complete_onboarding: {
        Args: { p_display_name: string; p_promo_consent: boolean }
        Returns: undefined
      }
      create_redemption: { Args: { p_customer: string; p_reward: string }; Returns: Json }
      customer_balance: { Args: { p_customer: string }; Returns: number }
      customer_dashboard: { Args: Record<PropertyKey, never>; Returns: Json }
      customer_purchase_count: { Args: { p_customer: string }; Returns: number }
      customer_streak_weeks: { Args: { p_customer: string }; Returns: number }
      expire_pending_claims: { Args: Record<PropertyKey, never>; Returns: number }
      expire_redemptions: { Args: { p_customer?: string }; Returns: number }
      games_status: { Args: Record<PropertyKey, never>; Returns: Json }
      generate_redemption_code: { Args: Record<PropertyKey, never>; Returns: string }
      local_day_start: { Args: Record<PropertyKey, never>; Returns: string }
      newly_unlocked_rewards: {
        Args: {
          p_balance_after: number
          p_balance_before: number
          p_purchases_after: number
          p_purchases_before: number
        }
        Returns: Json
      }
      pick_prize: { Args: { p_prizes: Json }; Returns: Json }
      play_game: { Args: { p_customer: string; p_game: string; p_ref?: string }; Returns: Json }
      rate_limit_hit: { Args: { p_action: string; p_customer: string }; Returns: boolean }
      reverse_claim: { Args: { p_sale_uuid: string }; Returns: boolean }
      setting_json: { Args: { p_key: string }; Returns: Json }
      update_profile: {
        Args: { p_display_name: string; p_promo_consent: boolean }
        Returns: undefined
      }
      validate_redemption: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
