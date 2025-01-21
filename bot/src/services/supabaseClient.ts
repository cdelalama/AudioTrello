import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/types";
import { config } from "../config";

if (!config.supabase.url || !config.supabase.anonKey) {
	throw new Error("Supabase credentials not found in environment variables");
}

export const supabase = createClient<Database>(config.supabase.url, config.supabase.anonKey);

// Validate Supabase connection
export async function validateSupabaseConnection() {
	try {
		const { data, error } = await supabase.from("users").select("count").single();
		if (error) throw error;
		console.log("✅ Supabase connection successful");
		return true;
	} catch (error) {
		console.error("❌ Supabase connection failed:", error);
		throw new Error("Could not connect to Supabase. Please check your credentials.");
	}
}
