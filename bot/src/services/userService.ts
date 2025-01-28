import { supabase } from "./supabaseClient";
import { InlineKeyboard } from "grammy";
import { User } from "../../types/types";

export const userService = {
	// Verificar si un usuario existe y está aprobado
	async isValidUser(telegramId: number): Promise<boolean> {
		const { data, error } = await supabase
			.from("users")
			.select("is_approved")
			.eq("telegram_id", telegramId)
			.single();

		if (error || !data) return false;
		return data.is_approved;
	},

	// Registrar un nuevo usuario
	async registerUser(telegramId: number, username: string): Promise<boolean> {
		const { error } = await supabase.from("users").insert({
			telegram_id: telegramId,
			username: username,
			is_approved: false,
			is_admin: false,
		});

		return !error;
	},

	// Obtener usuario por Telegram ID
	async getUserByTelegramId(telegramId: number): Promise<User | null> {
		const { data, error } = await supabase
			.from("users")
			.select("*")
			.eq("telegram_id", telegramId)
			.single();

		if (error || !data) return null;
		return data;
	},

	// Aprobar un usuario (solo admins)
	async approveUser(telegramId: number): Promise<boolean> {
		const { error } = await supabase
			.from("users")
			.update({ is_approved: true })
			.eq("telegram_id", telegramId);

		return !error;
	},

	// Crear usuario admin inicial
	async createInitialAdmin(): Promise<void> {
		const adminId = process.env.ADMIN_TELEGRAM_ID;

		if (!adminId) {
			throw new Error("Admin Telegram ID not found in environment variables");
		}

		// Verificar si ya existe un admin
		const { data } = await supabase.from("users").select("*").eq("is_admin", true).single();

		// Si no hay admin, esperaremos a que use /start para crearlo
		if (!data) {
			console.log("⚠️ No admin user found. Waiting for admin to use /start command...");
		}
	},

	// Registrar usuario admin inicial cuando use /start
	async registerInitialAdmin(telegramId: number, username: string): Promise<boolean> {
		const adminId = process.env.ADMIN_TELEGRAM_ID;

		if (adminId && Number(adminId) === telegramId) {
			const { error } = await supabase.from("users").insert({
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
	async isBanned(telegramId: number): Promise<boolean> {
		const { data } = await supabase
			.from("users")
			.select("is_active")
			.eq("telegram_id", telegramId)
			.single();

		return data ? !data.is_active : false;
	},

	// Obtener todos los admins
	async getAllAdmins(): Promise<User[]> {
		const { data } = await supabase
			.from("users")
			.select("*")
			.eq("is_admin", true)
			.eq("is_active", true);

		return data || [];
	},

	// Notificar a todos los admins
	async notifyAdmins(api: any, message: string, requesterId: number): Promise<void> {
		const admins = await this.getAllAdmins();
		const keyboard = new InlineKeyboard()
			.text("Accept ✅", `user_accept_${requesterId}`)
			.text("Reject ❌", `user_reject_${requesterId}`)
			.text("Cancel ⏳", `user_cancel_${requesterId}`);

		for (const admin of admins) {
			try {
				await api.sendMessage(admin.telegram_id, message, {
					reply_markup: keyboard,
				});
			} catch (error) {
				console.error(`Error notifying admin ${admin.telegram_id}:`, error);
			}
		}
	},

	// Banear/Desbanear usuario (solo admins)
	async toggleBan(telegramId: number): Promise<boolean> {
		const user = await this.getUserByTelegramId(telegramId);
		if (!user) return false;

		const { error } = await supabase
			.from("users")
			.update({ is_active: !user.is_active })
			.eq("telegram_id", telegramId);

		return !error;
	},

	// Obtener usuarios pendientes de aprobación
	async getPendingUsers(): Promise<User[]> {
		const { data } = await supabase
			.from("users")
			.select("*")
			.eq("is_active", true)
			.eq("is_approved", false)
			.order("created_at", { ascending: false });

		return data || [];
	},

	async createUser(userData: Omit<User, "id" | "created_at">): Promise<boolean> {
		try {
			const { error } = await supabase.from("users").insert(userData);
			return !error;
		} catch (error) {
			console.error("Error creating user:", error);
			return false;
		}
	},

	async requestApproval(telegramId: number): Promise<boolean> {
		try {
			const { error } = await supabase
				.from("users")
				.update({ approval_requested: true })
				.eq("telegram_id", telegramId);
			return !error;
		} catch (error) {
			console.error("Error requesting approval:", error);
			return false;
		}
	},

	async updateUser(userId: number, updates: Partial<User>): Promise<void> {
		const { error } = await supabase.from("users").update(updates).eq("id", userId);

		if (error) throw error;
	},
};
