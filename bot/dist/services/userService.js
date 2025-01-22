"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const supabaseClient_1 = require("./supabaseClient");
exports.userService = {
    // Verificar si un usuario existe y está aprobado
    async isValidUser(telegramId) {
        const { data, error } = await supabaseClient_1.supabase
            .from("users")
            .select("is_approved")
            .eq("telegram_id", telegramId)
            .single();
        if (error || !data)
            return false;
        return data.is_approved;
    },
    // Registrar un nuevo usuario
    async registerUser(telegramId, username) {
        const { error } = await supabaseClient_1.supabase.from("users").insert({
            telegram_id: telegramId,
            username: username,
            is_approved: false,
            is_admin: false,
        });
        return !error;
    },
    // Obtener usuario por Telegram ID
    async getUserByTelegramId(telegramId) {
        const { data, error } = await supabaseClient_1.supabase
            .from("users")
            .select("*")
            .eq("telegram_id", telegramId)
            .single();
        if (error || !data)
            return null;
        return data;
    },
    // Aprobar un usuario (solo admins)
    async approveUser(telegramId) {
        const { error } = await supabaseClient_1.supabase
            .from("users")
            .update({ is_approved: true })
            .eq("telegram_id", telegramId);
        return !error;
    },
    // Crear usuario admin inicial
    async createInitialAdmin() {
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (!adminId) {
            throw new Error("Admin Telegram ID not found in environment variables");
        }
        // Verificar si ya existe un admin
        const { data } = await supabaseClient_1.supabase.from("users").select("*").eq("is_admin", true).single();
        // Si no hay admin, esperaremos a que use /start para crearlo
        if (!data) {
            console.log("⚠️ No admin user found. Waiting for admin to use /start command...");
        }
    },
    // Registrar usuario admin inicial cuando use /start
    async registerInitialAdmin(telegramId, username) {
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (adminId && Number(adminId) === telegramId) {
            const { error } = await supabaseClient_1.supabase.from("users").insert({
                telegram_id: telegramId,
                username: username,
                is_approved: true,
                is_admin: true,
            });
            if (!error) {
                console.log("✅ Initial admin user created successfully");
            }
            return !error;
        }
        return false;
    },
    // Verificar si un usuario está baneado
    async isBanned(telegramId) {
        const { data } = await supabaseClient_1.supabase
            .from("users")
            .select("is_active")
            .eq("telegram_id", telegramId)
            .single();
        return data ? !data.is_active : false;
    },
    // Obtener todos los admins
    async getAllAdmins() {
        const { data } = await supabaseClient_1.supabase
            .from("users")
            .select("*")
            .eq("is_admin", true)
            .eq("is_active", true);
        return data || [];
    },
    // Notificar a todos los admins
    async notifyAdmins(bot, message) {
        const admins = await this.getAllAdmins();
        for (const admin of admins) {
            try {
                await bot.api.sendMessage(admin.telegram_id, message);
            }
            catch (error) {
                console.error(`Error notifying admin ${admin.telegram_id}:`, error);
            }
        }
    },
    // Banear/Desbanear usuario (solo admins)
    async toggleBan(telegramId) {
        const user = await this.getUserByTelegramId(telegramId);
        if (!user)
            return false;
        const { error } = await supabaseClient_1.supabase
            .from("users")
            .update({ is_active: !user.is_active })
            .eq("telegram_id", telegramId);
        return !error;
    },
    // Obtener usuarios pendientes de aprobación
    async getPendingUsers() {
        const { data } = await supabaseClient_1.supabase
            .from("users")
            .select("*")
            .eq("is_active", true)
            .eq("is_approved", false)
            .order("created_at", { ascending: false });
        return data || [];
    },
};
