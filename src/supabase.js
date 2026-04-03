// ─── supabase.js ──────────────────────────────────────────────────────────────
// All Supabase auth + data operations in one place.
// Import { supabase, auth, db } into App.jsx.
//
// Setup:
//   1. npm install @supabase/supabase-js
//   2. Add to your .env file:
//        VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
//        VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
//      (find these in Supabase → Project Settings → API)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn("⚠️  Supabase env vars missing — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);


// ─── Auth helpers ─────────────────────────────────────────────────────────────

export const auth = {
    // Sign up with email + password + optional display name
    async signUp({ email, password, fullName }) {
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        return data;
    },

    // Sign in
    async signIn({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    // Sign in with Google (optional — enable in Supabase Auth → Providers)
    async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
        if (error) throw error;
    },

    // Sign out
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // Get current session (call on app load)
    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    // Subscribe to auth state changes
    onAuthChange(callback) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            callback(session?.user || null);
        });
        return () => subscription.unsubscribe();
    },

    // Send password reset email
    async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }
};


// ─── Profile ──────────────────────────────────────────────────────────────────

export const db = {
    // Fetch user profile
    async getProfile(userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();
        if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
        return data;
    },

    // Update profile fields
    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from("profiles")
            .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
            .select()
            .single();
        if (error) throw error;
        return data;
    },


    // ─── Conversations ──────────────────────────────────────────────────────────

    // Load all conversations for a user (most recent first, no messages — just metadata)
    async getConversations(userId) {
        const { data, error } = await supabase
            .from("conversations")
            .select("id, preview, summary, created_at, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(20);
        if (error) throw error;
        return data || [];
    },

    // Load a single full conversation (with messages)
    async getConversation(conversationId) {
        const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .single();
        if (error) throw error;
        return data;
    },

    // Create or update a conversation (upsert by id)
    async saveConversation({ id, userId, preview, summary, messages, recommendations }) {
        const payload = {
            user_id: userId,
            preview: (preview || "").slice(0, 120),
            summary: summary || "",
            messages: messages || [],
            recommendations: recommendations || [],
            updated_at: new Date().toISOString(),
        };
        if (id) payload.id = id;

        const { data, error } = await supabase
            .from("conversations")
            .upsert(payload)
            .select("id")
            .single();
        if (error) throw error;
        return data.id;
    },

    // Delete a conversation
    async deleteConversation(conversationId) {
        const { error } = await supabase
            .from("conversations")
            .delete()
            .eq("id", conversationId);
        if (error) throw error;
    },


    // ─── Favourites ─────────────────────────────────────────────────────────────

    // Get all favourites for a user
    async getFavourites(userId) {
        const { data, error } = await supabase
            .from("favourites")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // Add a favourite
    async addFavourite(userId, listing, note = "") {
        const { data, error } = await supabase
            .from("favourites")
            .upsert({
                user_id: userId,
                listing_id: listing.id,
                listing_data: listing,
                note,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Remove a favourite
    async removeFavourite(userId, listingId) {
        const { error } = await supabase
            .from("favourites")
            .delete()
            .eq("user_id", userId)
            .eq("listing_id", listingId);
        if (error) throw error;
    },

    // Check if a listing is favourited
    async isFavourited(userId, listingId) {
        const { data } = await supabase
            .from("favourites")
            .select("id")
            .eq("user_id", userId)
            .eq("listing_id", listingId)
            .single();
        return !!data;
    },


    // ─── Search Preferences ─────────────────────────────────────────────────────

    async getPreferences(userId) {
        const { data, error } = await supabase
            .from("search_preferences")
            .select("*")
            .eq("user_id", userId)
            .single();
        if (error && error.code !== "PGRST116") throw error;
        return data;
    },

    async savePreferences(userId, prefs) {
        const { data, error } = await supabase
            .from("search_preferences")
            .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ── Viewings ────────────────────────────────────────────────────────────────
    async getViewings(userId) {
        const { data, error } = await supabase
            .from("viewings")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async addViewing(userId, listing, message, scheduledDate = null) {
        const { data, error } = await supabase
            .from("viewings")
            .insert({
                user_id: userId,
                listing_id: listing.id,
                listing_data: listing,
                message,
                status: "pending",
                scheduled_date: scheduledDate,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateViewingStatus(viewingId, status) {
        const { data, error } = await supabase
            .from("viewings")
            .update({ status })
            .eq("id", viewingId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteViewing(viewingId) {
        const { error } = await supabase
            .from("viewings")
            .delete()
            .eq("id", viewingId);
        if (error) throw error;
        return true;
    },


    // ─── Landlord Listings ───────────────────────────────────────────────────
    // Requires this table in Supabase (run once in the SQL editor):
    //
    //   create table user_listings (
    //     id         uuid default gen_random_uuid() primary key,
    //     user_id    uuid references auth.users(id) on delete cascade not null,
    //     listing_id text not null,
    //     listing_data jsonb not null,
    //     created_at timestamptz default now() not null
    //   );
    //   alter table user_listings enable row level security;
    //   create policy "Users manage own listings"
    //     on user_listings for all using (auth.uid() = user_id);

    async getLandlordListings(userId) {
        const { data, error } = await supabase
            .from("user_listings")
            .select("listing_data")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(r => r.listing_data);
    },

    async addLandlordListing(userId, listing) {
        const { data, error } = await supabase
            .from("user_listings")
            .upsert({
                user_id: userId,
                listing_id: String(listing.id),
                listing_data: listing,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateLandlordListing(userId, listing) {
        const { error } = await supabase
            .from("user_listings")
            .update({ listing_data: listing })
            .eq("user_id", userId)
            .eq("listing_id", String(listing.id));
        if (error) throw error;
    },

    async removeLandlordListing(userId, listingId) {
        const { error } = await supabase
            .from("user_listings")
            .delete()
            .eq("user_id", userId)
            .eq("listing_id", String(listingId));
        if (error) throw error;
    },
};