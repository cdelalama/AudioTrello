"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.validateSupabaseConnection = validateSupabaseConnection;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
if (!config_1.config.supabase.url || !config_1.config.supabase.anonKey) {
    throw new Error("Supabase credentials not found in environment variables");
}
exports.supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.anonKey);
// Validate Supabase connection
async function validateSupabaseConnection() {
    try {
        const { data, error } = await exports.supabase.from("users").select("count").single();
        if (error)
            throw error;
        console.log("✅ Supabase connection successful");
        return true;
    }
    catch (error) {
        console.error("❌ Supabase connection failed:", error);
        throw new Error("Could not connect to Supabase. Please check your credentials.");
    }
}
