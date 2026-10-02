export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type NoRelationships = [];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: "customer" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "customer" | "admin";
        };
        Update: {
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "customer" | "admin";
        };
        Relationships: NoRelationships;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: NoRelationships;
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          sale_price: number | null;
          is_available: boolean;
          is_featured: boolean;
          is_customizable: boolean;
          stock_quantity: number | null;
          prep_time_hours: number | null;
          min_order_quantity: number;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          description?: string | null;
          price: number;
          sale_price?: number | null;
          is_available?: boolean;
          is_featured?: boolean;
          is_customizable?: boolean;
          stock_quantity?: number | null;
          prep_time_hours?: number | null;
          min_order_quantity?: number;
          tags?: string[] | null;
        };
        Update: {
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          price?: number;
          sale_price?: number | null;
          is_available?: boolean;
          is_featured?: boolean;
          is_customizable?: boolean;
          stock_quantity?: number | null;
          prep_time_hours?: number | null;
          min_order_quantity?: number;
          tags?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt_text?: string | null;
          sort_order?: number;
        };
        Update: {
          product_id?: string;
          url?: string;
          alt_text?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_options: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          type: "select" | "text" | "multiline" | "date" | "file";
          is_required: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          type?: "select" | "text" | "multiline" | "date" | "file";
          is_required?: boolean;
          sort_order?: number;
        };
        Update: {
          product_id?: string;
          name?: string;
          type?: "select" | "text" | "multiline" | "date" | "file";
          is_required?: boolean;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_values: {
        Row: {
          id: string;
          option_id: string;
          value: string;
          price_delta: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          option_id: string;
          value: string;
          price_delta?: number;
          sort_order?: number;
        };
        Update: {
          option_id?: string;
          value?: string;
          price_delta?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "product_options";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          fulfillment_type: "delivery" | "pickup";
          address_line: string | null;
          city: string | null;
          state: string | null;
          landmark: string | null;
          delivery_instructions: string | null;
          requested_date: string | null;
          requested_time: string | null;
          notes: string | null;
          subtotal: number;
          delivery_fee: number;
          discount: number;
          total: number;
          payment_method: "paystack" | "bank_transfer" | "cash";
          payment_status: "pending" | "processing" | "awaiting_payment" | "paid" | "failed" | "abandoned" | "refunded";
          order_status: string;
          payment_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          fulfillment_type: "delivery" | "pickup";
          address_line?: string | null;
          city?: string | null;
          state?: string | null;
          landmark?: string | null;
          delivery_instructions?: string | null;
          requested_date?: string | null;
          requested_time?: string | null;
          notes?: string | null;
          subtotal: number;
          delivery_fee: number;
          discount?: number;
          total: number;
          payment_method: "paystack" | "bank_transfer" | "cash";
          payment_status?: "pending" | "processing" | "awaiting_payment" | "paid" | "failed" | "abandoned" | "refunded";
          order_status?: string;
          payment_reference?: string | null;
        };
        Update: {
          order_number?: string;
          user_id?: string | null;
          customer_name?: string;
          customer_email?: string;
          customer_phone?: string;
          fulfillment_type?: "delivery" | "pickup";
          address_line?: string | null;
          city?: string | null;
          state?: string | null;
          landmark?: string | null;
          delivery_instructions?: string | null;
          requested_date?: string | null;
          requested_time?: string | null;
          notes?: string | null;
          subtotal?: number;
          delivery_fee?: number;
          discount?: number;
          total?: number;
          payment_method?: "paystack" | "bank_transfer" | "cash";
          payment_status?: "pending" | "processing" | "awaiting_payment" | "paid" | "failed" | "abandoned" | "refunded";
          order_status?: string;
          payment_reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          unit_price: number;
          quantity: number;
          line_total: number;
          customizations: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          unit_price: number;
          quantity: number;
          line_total: number;
          customizations?: Json | null;
        };
        Update: {
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          unit_price?: number;
          quantity?: number;
          line_total?: number;
          customizations?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_options: {
        Row: {
          id: string;
          order_item_id: string;
          option_name: string;
          option_value: string;
          price_delta: number;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          option_name: string;
          option_value: string;
          price_delta?: number;
        };
        Update: {
          order_item_id?: string;
          option_name?: string;
          option_value?: string;
          price_delta?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_options_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          method: "paystack" | "bank_transfer" | "cash";
          status: "pending" | "processing" | "awaiting_payment" | "paid" | "failed" | "abandoned" | "refunded";
          amount: number;
          reference: string | null;
          paystack_authorization_url: string | null;
          raw_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          method: "paystack" | "bank_transfer" | "cash";
          status?: "pending" | "processing" | "awaiting_payment" | "paid" | "failed" | "abandoned" | "refunded";
          amount: number;
          reference?: string | null;
          paystack_authorization_url?: string | null;
          raw_payload?: Json | null;
        };
        Update: {
          order_id?: string;
          method?: "paystack" | "bank_transfer" | "cash";
          status?: "pending" | "processing" | "awaiting_payment" | "paid" | "failed" | "abandoned" | "refunded";
          amount?: number;
          reference?: string | null;
          paystack_authorization_url?: string | null;
          raw_payload?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_settings: {
        Row: {
          id: string;
          zone_name: string;
          states: string[] | null;
          fee: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zone_name: string;
          states?: string[] | null;
          fee: number;
          is_active?: boolean;
        };
        Update: {
          zone_name?: string;
          states?: string[] | null;
          fee?: number;
          is_active?: boolean;
        };
        Relationships: NoRelationships;
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
        };
        Update: {
          value?: Json;
        };
        Relationships: NoRelationships;
      };
      customer_addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          address_line: string;
          city: string;
          state: string;
          landmark: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          address_line: string;
          city: string;
          state: string;
          landmark?: string | null;
          is_default?: boolean;
        };
        Update: {
          label?: string | null;
          address_line?: string;
          city?: string;
          state?: string;
          landmark?: string | null;
          is_default?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "customer_addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string | null;
          user_id: string;
          customer_name: string;
          rating: number;
          comment: string | null;
          is_approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          user_id: string;
          customer_name: string;
          rating: number;
          comment?: string | null;
          is_approved?: boolean;
        };
        Update: {
          product_id?: string | null;
          customer_name?: string;
          rating?: number;
          comment?: string | null;
          is_approved?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_state: {
        Row: {
          user_id: string;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          items?: Json;
        };
        Update: {
          items?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "cart_state_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          id: string;
          payment_id: string;
          event: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          event: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          event?: string;
          detail?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_users: {
        Row: {
          user_id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
        };
        Update: {
          email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      payment_method: "paystack" | "bank_transfer" | "cash";
      payment_status: "pending" | "awaiting_payment" | "paid" | "failed" | "refunded";
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
