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
      admin_sig_nonces: {
        Row: {
          admin_address: string
          signature: string
          used_at: string
        }
        Insert: {
          admin_address: string
          signature: string
          used_at?: string
        }
        Update: {
          admin_address?: string
          signature?: string
          used_at?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          category: string
          condition: string
          created_at: string
          description: string
          featured: boolean
          featured_until: string | null
          id: string
          images: string[]
          location: string
          price_usdc: number
          seller_id: string
          sold_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          condition: string
          created_at?: string
          description: string
          featured?: boolean
          featured_until?: string | null
          id?: string
          images?: string[]
          location: string
          price_usdc: number
          seller_id: string
          sold_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          description?: string
          featured?: boolean
          featured_until?: string | null
          id?: string
          images?: string[]
          location?: string
          price_usdc?: number
          seller_id?: string
          sold_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_activity: {
        Row: {
          agent_id: string
          created_at: string
          detail: Json | null
          endpoint: string
          id: number
          method: string
          status_code: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          detail?: Json | null
          endpoint: string
          id?: number
          method: string
          status_code: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          detail?: Json | null
          endpoint?: string
          id?: number
          method?: string
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_rate_limits: {
        Row: {
          bucket_key: string
          created_at: string
          endpoint: string
          id: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          endpoint: string
          id?: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          endpoint?: string
          id?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["agent_kind"]
          max_spend_usdc_per_day: number
          owner_user_id: string | null
          reputation_score: number
          status: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          display_name: string
          id?: string
          kind?: Database["public"]["Enums"]["agent_kind"]
          max_spend_usdc_per_day?: number
          owner_user_id?: string | null
          reputation_score?: number
          status?: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          display_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["agent_kind"]
          max_spend_usdc_per_day?: number
          owner_user_id?: string | null
          reputation_score?: number
          status?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      escrows: {
        Row: {
          ad_id: string
          amount_usdc: number
          buyer_id: string
          chain_id: number
          circle_escrow_id: string | null
          created_at: string
          deposit_tx_hash: string | null
          funded_at: string | null
          id: string
          metadata: Json
          offer_id: string | null
          refund_tx_hash: string | null
          refunded_at: string | null
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: string
          tx_hashes: Json
          updated_at: string
        }
        Insert: {
          ad_id: string
          amount_usdc: number
          buyer_id: string
          chain_id: number
          circle_escrow_id?: string | null
          created_at?: string
          deposit_tx_hash?: string | null
          funded_at?: string | null
          id?: string
          metadata?: Json
          offer_id?: string | null
          refund_tx_hash?: string | null
          refunded_at?: string | null
          release_tx_hash?: string | null
          released_at?: string | null
          seller_id: string
          status?: string
          tx_hashes?: Json
          updated_at?: string
        }
        Update: {
          ad_id?: string
          amount_usdc?: number
          buyer_id?: string
          chain_id?: number
          circle_escrow_id?: string | null
          created_at?: string
          deposit_tx_hash?: string | null
          funded_at?: string | null
          id?: string
          metadata?: Json
          offer_id?: string | null
          refund_tx_hash?: string | null
          refunded_at?: string | null
          release_tx_hash?: string | null
          released_at?: string | null
          seller_id?: string
          status?: string
          tx_hashes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrows_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrows_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ad_id: string | null
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          ad_id?: string | null
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          ad_id?: string | null
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          ad_id: string
          amount_usdc: number
          buyer_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          ad_id: string
          amount_usdc: number
          buyer_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          ad_id?: string
          amount_usdc?: number
          buyer_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          ad_id: string
          amount_usdc: number
          buyer_id: string
          chain_id: number
          created_at: string
          id: string
          seller_id: string
          tx_hash: string
        }
        Insert: {
          ad_id: string
          amount_usdc: number
          buyer_id: string
          chain_id: number
          created_at?: string
          id?: string
          seller_id: string
          tx_hash: string
        }
        Update: {
          ad_id?: string
          amount_usdc?: number
          buyer_id?: string
          chain_id?: number
          created_at?: string
          id?: string
          seller_id?: string
          tx_hash?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          circle_user_id: string | null
          circle_wallet_address: string | null
          created_at: string
          display_name: string | null
          id: string
          rating: number | null
          total_ads: number | null
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          circle_user_id?: string | null
          circle_wallet_address?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          rating?: number | null
          total_ads?: number | null
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          circle_user_id?: string | null
          circle_wallet_address?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          rating?: number | null
          total_ads?: number | null
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          ad_id: string
          chain_id: number | null
          created_at: string
          ends_at: string
          id: string
          owner_user_id: string
          price_usdc: number
          starts_at: string
          status: string
          tier: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          ad_id: string
          chain_id?: number | null
          created_at?: string
          ends_at: string
          id?: string
          owner_user_id: string
          price_usdc: number
          starts_at?: string
          status?: string
          tier: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          ad_id?: string
          chain_id?: number | null
          created_at?: string
          ends_at?: string
          id?: string
          owner_user_id?: string
          price_usdc?: number
          starts_at?: string
          status?: string
          tier?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ad_id: string
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          seller_id: string
        }
        Insert: {
          ad_id: string
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          seller_id: string
        }
        Update: {
          ad_id?: string
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          seller_id?: string
        }
        Relationships: []
      }
      siwe_nonces: {
        Row: {
          address: string | null
          created_at: string
          nonce: string
          used_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          nonce: string
          used_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          nonce?: string
          used_at?: string | null
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          address: string
          chain_id: number | null
          created_at: string
          id: string
          is_primary: boolean
          kind: string
          label: string | null
          linked_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          kind: string
          label?: string | null
          linked_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          kind?: string
          label?: string | null
          linked_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_admin_sig_nonces: { Args: never; Returns: undefined }
      cleanup_agent_rate_limits: { Args: never; Returns: undefined }
    }
    Enums: {
      agent_kind: "delegated" | "standalone"
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
      agent_kind: ["delegated", "standalone"],
    },
  },
} as const
