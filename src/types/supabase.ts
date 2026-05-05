/**
 * Supabase Database types for LINA e-commerce MVP.
 * Covers only the tables used by the sync pipeline and cron health check.
 *
 * Re-generate from live DB with: npx supabase gen types typescript --linked
 */

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
      sync_jobs: {
        Row: {
          id: string;
          job_type: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          records_synced: number | null;
          error_message: string | null;
        };
        Insert: {
          id: string;
          job_type: string;
          status?: string;
          started_at?: string;
          finished_at?: string | null;
          records_synced?: number | null;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          job_type?: string;
          status?: string;
          started_at?: string;
          finished_at?: string | null;
          records_synced?: number | null;
          error_message?: string | null;
        };
        Relationships: [];
      };

      products_1688: {
        Row: {
          id: string;
          item_id: string;
          title: string | null;
          price_cny: number | null;
          min_order: number | null;
          unit: string | null;
          images: string[] | null;
          category: string | null;
          category_id: string | null;
          supplier_id: string | null;
          supplier_name: string | null;
          raw_data: Json | null;
          sync_status: string;
          synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          title?: string | null;
          price_cny?: number | null;
          min_order?: number | null;
          unit?: string | null;
          images?: string[] | null;
          category?: string | null;
          category_id?: string | null;
          supplier_id?: string | null;
          supplier_name?: string | null;
          raw_data?: Json | null;
          sync_status?: string;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          title?: string | null;
          price_cny?: number | null;
          min_order?: number | null;
          unit?: string | null;
          images?: string[] | null;
          category?: string | null;
          category_id?: string | null;
          supplier_id?: string | null;
          supplier_name?: string | null;
          raw_data?: Json | null;
          sync_status?: string;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      products: {
        Row: {
          id: string;
          source_id: string | null;
          source_url: string | null;
          source_platform: string | null;
          slug: string;
          category_id: string | null;
          price_cny: number;
          is_active: boolean;
          is_featured: boolean;
          stock_status: string;
          view_count: number;
          order_count: number;
          rating: number | null;
          rating_count: number;
          raw_attributes: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_id?: string | null;
          source_url?: string | null;
          source_platform?: string | null;
          slug: string;
          category_id?: string | null;
          price_cny: number;
          is_active?: boolean;
          is_featured?: boolean;
          stock_status?: string;
          view_count?: number;
          order_count?: number;
          rating?: number | null;
          rating_count?: number;
          raw_attributes?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string | null;
          source_url?: string | null;
          source_platform?: string | null;
          slug?: string;
          category_id?: string | null;
          price_cny?: number;
          is_active?: boolean;
          is_featured?: boolean;
          stock_status?: string;
          view_count?: number;
          order_count?: number;
          rating?: number | null;
          rating_count?: number;
          raw_attributes?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      product_translations: {
        Row: {
          id: string;
          product_id: string;
          language_code: string;
          name: string;
          description: string | null;
          short_desc: string | null;
          meta_title: string | null;
          meta_desc: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          language_code: string;
          name: string;
          description?: string | null;
          short_desc?: string | null;
          meta_title?: string | null;
          meta_desc?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          language_code?: string;
          name?: string;
          description?: string | null;
          short_desc?: string | null;
          meta_title?: string | null;
          meta_desc?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "product_translations_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };

      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt: string | null;
          sort_order: number;
          is_primary: boolean;
          thumbnail_url: string | null;
          medium_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          thumbnail_url?: string | null;
          medium_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          thumbnail_url?: string | null;
          medium_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "product_images_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };

      currencies: {
        Row: {
          code: string;
          name: string;
          symbol: string;
          decimal_places: number;
          is_active: boolean;
          rate_to_usd: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          symbol: string;
          decimal_places?: number;
          is_active?: boolean;
          rate_to_usd?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          symbol?: string;
          decimal_places?: number;
          is_active?: boolean;
          rate_to_usd?: number;
          updated_at?: string;
        };
        Relationships: [];
      };

      currency_rates: {
        Row: {
          id: string;
          from_currency: string;
          to_currency: string;
          rate: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          from_currency: string;
          to_currency: string;
          rate: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          from_currency?: string;
          to_currency?: string;
          rate?: number;
          recorded_at?: string;
        };
        Relationships: [];
      };

      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          name: string | null;
          source_sku_id: string | null;
          price_cny: number;
          attributes: Json | null;
          stock_qty: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          name?: string | null;
          source_sku_id?: string | null;
          price_cny: number;
          attributes?: Json | null;
          stock_qty?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          name?: string | null;
          source_sku_id?: string | null;
          price_cny?: number;
          attributes?: Json | null;
          stock_qty?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "product_variants_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
