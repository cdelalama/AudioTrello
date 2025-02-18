"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const supabaseClient_1 = require("./supabaseClient");
const grammy_1 = require("grammy");
// Cache de usuarios para edición
const userCache = new Map();
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
        try {
            // Comprobar cache (válido por 5 minutos)
            const cached = userCache.get(telegramId);
            if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
                return cached.user;
            }
            // Si no está en cache, obtener de BD
            let userData = await this.getUserFromDB(telegramId);
            if (userData) {
                userCache.set(telegramId, {
                    user: userData,
                    timestamp: Date.now(),
                });
            }
            return userData;
        }
        catch (error) {
            console.error("Error in getUserByTelegramId:", error);
            return null;
        }
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
    async notifyAdmins(api, message, requesterId) {
        const admins = await this.getAllAdmins();
        const keyboard = new grammy_1.InlineKeyboard()
            .text("Accept ✅", `user_accept_${requesterId}`)
            .text("Reject ❌", `user_reject_${requesterId}`)
            .text("Cancel ⏳", `user_cancel_${requesterId}`);
        for (const admin of admins) {
            try {
                await api.sendMessage(admin.telegram_id, message, {
                    reply_markup: keyboard,
                });
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
    async createUser(userData) {
        try {
            const { error } = await supabaseClient_1.supabase.from("users").insert(userData);
            return !error;
        }
        catch (error) {
            console.error("Error creating user:", error);
            return false;
        }
    },
    async requestApproval(telegramId) {
        try {
            const { error } = await supabaseClient_1.supabase
                .from("users")
                .update({ approval_requested: true })
                .eq("telegram_id", telegramId);
            return !error;
        }
        catch (error) {
            console.error("Error requesting approval:", error);
            return false;
        }
    },
    async cleanTrelloConfig(userId) {
        try {
            const { error } = await supabaseClient_1.supabase
                .from("users")
                .update({
                default_board_id: null,
                default_board_name: null,
                default_list_id: null,
                default_list_name: null,
            })
                .eq("id", userId);
            if (error) {
                console.error("Error cleaning Trello config:", error);
            }
        }
        catch (error) {
            console.error("Error in cleanTrelloConfig:", error);
        }
    },
    async updateUser(userId, updates) {
        try {
            // Aquí está la verificación de inconsistencia
            if (
            // Caso 1: Hay board_id pero no hay board_name
            (updates.default_board_id && !updates.default_board_name) ||
                // Caso 2: No hay board_id pero hay board_name
                (!updates.default_board_id && updates.default_board_name) ||
                // Caso 3: Hay list_id pero no hay list_name
                (updates.default_list_id && !updates.default_list_name) ||
                // Caso 4: No hay list_id pero hay list_name
                (!updates.default_list_id && updates.default_list_name)) {
                console.error("Inconsistent Trello configuration update attempted");
                // Si detecta inconsistencia, limpia TODO
                await this.cleanTrelloConfig(userId);
                return false;
            }
            // Si todo está bien, hace el update
            const { error } = await supabaseClient_1.supabase.from("users").update(updates).eq("id", userId);
            return !error;
        }
        catch (error) {
            console.error("Error updating user:", error);
            return false;
        }
    },
    async disconnectTrello(userId) {
        try {
            const { error } = await supabaseClient_1.supabase
                .from("users")
                .update({
                trello_token: null,
                trello_username: null,
                default_board_id: null,
                default_board_name: null,
                default_list_id: null,
                default_list_name: null,
                waiting_for_token: false,
            })
                .eq("id", userId);
            return !error;
        }
        catch (error) {
            console.error("Error disconnecting Trello:", error);
            return false;
        }
    },
    async updateUserTimezone(userId, languageCode) {
        try {
            const now = new Date();
            const isDST = this.isDaylightSavingTime(now);
            const offset = isDST ? 120 : 60; // 120 minutos en verano, 60 en invierno
            await supabaseClient_1.supabase
                .from("users")
                .update({
                language_code: languageCode || "es",
                timezone_offset: offset,
                timezone_last_updated: now.toISOString(),
            })
                .eq("id", userId);
        }
        catch (error) {
            console.error("Error updating user timezone:", error);
        }
    },
    isDaylightSavingTime(date) {
        const year = date.getFullYear();
        const dstStart = this.getLastSunday(year, 2); // Marzo es 2 (0-based)
        const dstEnd = this.getLastSunday(year, 9); // Octubre es 9 (0-based)
        return date >= dstStart && date < dstEnd;
    },
    getLastSunday(year, month) {
        const date = new Date(year, month + 1, 0); // Último día del mes
        const lastSunday = new Date(date.setDate(date.getDate() - date.getDay()));
        return lastSunday;
    },
    async getUserFromDB(telegramId) {
        let userData;
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 segundos
        while (retryCount < maxRetries) {
            const { data, error } = await supabaseClient_1.supabase
                .from("users")
                .select("*")
                .eq("telegram_id", telegramId)
                .single();
            if (!error) {
                userData = data;
                break;
            }
            console.error(`Error getting user (attempt ${retryCount + 1}/${maxRetries}):`, error);
            retryCount++;
            if (retryCount < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
        if (!userData) {
            console.error(`Failed to get user after ${maxRetries} attempts`);
            return null;
        }
        console.log("Raw user data from DB:", userData);
        // Verificar consistencia al obtener los datos
        if (userData &&
            ((userData.default_board_id && !userData.default_board_name) ||
                (!userData.default_board_id && userData.default_board_name) ||
                (userData.default_list_id && !userData.default_list_name) ||
                (!userData.default_list_id && userData.default_list_name))) {
            console.error("Inconsistent Trello configuration detected, cleaning...");
            await this.cleanTrelloConfig(userData.id);
            // Volver a obtener los datos limpios
            const { data: cleanData } = await supabaseClient_1.supabase
                .from("users")
                .select("*")
                .eq("telegram_id", telegramId)
                .single();
            return cleanData;
        }
        return userData;
    },
};
