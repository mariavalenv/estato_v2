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

    // Convert UUID to stable integer for legacy listing_id column
    _uuidToInt(uuid) {
        if (typeof uuid === 'number') return uuid;
        const hex = String(uuid).replace(/-/g, '').slice(0, 8);
        return parseInt(hex, 16) % 2147483647;
    },

    // Add a favourite
    async addFavourite(userId, listing, note = "") {
        const listingId = this._uuidToInt(listing.id);
        const { data, error } = await supabase
            .from("favourites")
            .upsert({
                user_id: userId,
                listing_id: listingId,
                listing_data: { ...listing, match_id: listing.id },
                note,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Remove a favourite
    async removeFavourite(userId, listingId) {
        const numericId = this._uuidToInt(listingId);
        const { error } = await supabase
            .from("favourites")
            .delete()
            .eq("user_id", userId)
            .eq("listing_id", numericId);
        if (error) throw error;
    },

    // Check if a listing is favourited
    async isFavourited(userId, listingId) {
        const numericId = this._uuidToInt(listingId);
        const { data } = await supabase
            .from("favourites")
            .select("id")
            .eq("user_id", userId)
            .eq("listing_id", numericId)
            .single();
        return !!data;
    },


    // ─── Search Preferences ─────────────────────────────────────────────────────
    //
    // The DB schema uses snake_case flat columns (budget_min, budget_max, cities[],
    // min_beds, timeline, commute_destination, …).  The rest of the app (forms,
    // screening chat) uses a slightly different shape (budget:{min,max}, city,
    // move_in_timeline, bedrooms, commute_anchor, …).  These two helpers normalise
    // on the way IN and denormalise on the way OUT so callers don't have to care.

    async getPreferences(userId) {
        const { data, error } = await supabase
            .from("search_preferences")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;

        // Denormalise DB row → app shape
        return {
            ...data,
            // convenient aliases used by forms & ScreeningChat
            city: data.cities?.[0] || '',
            neighbourhoods: data.areas || [],
            move_in_timeline: data.timeline || '',
            budget: { min: data.budget_min ?? null, max: data.budget_max ?? null },
            flat_type: data.intent || '',
            bedrooms: data.min_beds ?? 1,
            commute_anchor: data.commute_destination || '',
            deal_breakers: data.notes ? data.notes.split(',').map(s => s.trim()).filter(Boolean) : [],
        };
    },

    async savePreferences(userId, prefs) {
        // Normalise app shape → DB columns
        const row = { user_id: userId, updated_at: new Date().toISOString() };

        // cities
        if (Array.isArray(prefs.cities)) row.cities = prefs.cities;
        else if (prefs.city) row.cities = [prefs.city];

        // areas / neighbourhoods
        if (Array.isArray(prefs.areas)) row.areas = prefs.areas;
        else if (Array.isArray(prefs.neighbourhoods)) row.areas = prefs.neighbourhoods;

        // timeline
        row.timeline = prefs.timeline || prefs.move_in_timeline || null;

        // budget
        if (prefs.budget_min != null) row.budget_min = prefs.budget_min;
        else if (prefs.budget?.min != null) row.budget_min = prefs.budget.min;

        if (prefs.budget_max != null) row.budget_max = prefs.budget_max;
        else if (prefs.budget?.max != null) row.budget_max = prefs.budget.max;

        // bedrooms → min_beds
        if (prefs.min_beds != null) {
            row.min_beds = prefs.min_beds;
        } else if (prefs.bedrooms != null) {
            const n = prefs.bedrooms === 'Studio' ? 0 : parseInt(prefs.bedrooms, 10);
            if (!isNaN(n)) row.min_beds = n;
        }

        // intent / flat_type
        row.intent = prefs.intent || prefs.flat_type || null;

        // must_haves
        if (prefs.must_haves != null) row.must_haves = prefs.must_haves;

        // commute
        row.commute_destination = prefs.commute_destination || prefs.commute_anchor || null;

        // deal_breakers → notes (as comma-separated string)
        if (prefs.deal_breakers != null) {
            row.notes = Array.isArray(prefs.deal_breakers)
                ? prefs.deal_breakers.join(', ')
                : prefs.deal_breakers;
        }

        // pass through any valid DB columns that arrived directly
        const directCols = ['types', 'max_beds', 'pet_friendly', 'parking', 'outdoor',
            'quiet', 'near_transport', 'looking_for_flatmate', 'partner_preferences',
            'my_age', 'my_gender', 'my_occupation', 'my_lifestyle', 'my_bio',
            'flatmate_gender', 'flatmate_age_range', 'flatmate_lifestyle', 'flatmate_dealbreakers',
            'commute_max_minutes'];
        for (const col of directCols) {
            if (prefs[col] != null) row[col] = prefs[col];
        }

        // Verify the client has an active session before writing
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("savePreferences: no active session — user not authenticated");

        // Fetch existing row id so upsert targets the right row (user_id has no unique constraint)
        const { data: existing, error: selectErr } = await supabase
            .from("search_preferences")
            .select("id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (selectErr) console.warn("savePreferences select error:", selectErr.code, selectErr.message);
        if (existing?.id) row.id = existing.id;

        const { data, error } = await supabase
            .from("search_preferences")
            .upsert(row)
            .select()
            .single();
        if (error) {
            console.error("savePreferences upsert error:", error.code, error.message, error.details);
            throw error;
        }
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


    // ─── Session conversations ───────────────────────────────────────────────
    // One row per message, scoped to a session_id. See migrations 006 + 007.

    // Fetch ONLY the current session's messages, in chronological order.
    async getSessionMessages(userId, sessionId) {
        const { data, error } = await supabase
            .from("screening_messages")
            .select("role, content, created_at")
            .eq("user_id", userId)
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    // Append one message (user or assistant) to the current session.
    async addSessionMessage(userId, sessionId, role, content) {
        const { error } = await supabase
            .from("screening_messages")
            .insert({ user_id: userId, session_id: sessionId, role, content });
        if (error) throw error;
    },


    // ─── User memory ─────────────────────────────────────────────────────────
    // One JSON memory blob per user (see migration 007).

    async getUserMemory(userId) {
        const { data, error } = await supabase
            .from("user_memory")
            .select("memory")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) throw error;
        return data?.memory ?? null;
    },

    async saveUserMemory(userId, memory) {
        const { error } = await supabase
            .from("user_memory")
            .upsert({
                user_id: userId,
                memory: memory ?? {},
                updated_at: new Date().toISOString(),
            });
        if (error) throw error;
    },
};