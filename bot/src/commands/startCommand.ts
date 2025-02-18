import { Bot, InlineKeyboard } from "grammy";
import { userService } from "../services/userService";
import { messages } from "../messages/messages";
import { helpMessages } from "../messages/helpMessages";

export function setupStartCommand(bot: Bot) {
	bot.command("start", async (ctx) => {
		try {
			if (!ctx.from) {
				await ctx.reply(messages.errors.noUser);
				return;
			}

			const user = await userService.getUserByTelegramId(ctx.from.id);

			// Primero verificar si está baneado
			if (user && !user.is_active) {
				await ctx.reply(messages.welcome.banned);
				return;
			}

			// Si el usuario ya está aprobado
			if (user?.is_approved) {
				// Actualizar timezone si han pasado más de 7 días
				const lastUpdate = new Date(user.timezone_last_updated);
				const now = new Date();
				const daysSinceUpdate =
					(now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

				if (daysSinceUpdate >= 7) {
					await userService.updateUserTimezone(user.id, ctx.from.language_code);
				}

				await ctx.reply(messages.welcome.approved);
				await ctx.reply(helpMessages.start, {
					parse_mode: "Markdown",
				});
				return;
			}

			// Si el usuario existe pero no está aprobado
			if (user) {
				if (user.approval_requested) {
					await ctx.reply(messages.welcome.alreadyRequested);
					return;
				}
				const keyboard = new InlineKeyboard().text(
					"Request Approval 🔑",
					"request_approval"
				);
				await ctx.reply(messages.welcome.notApproved, { reply_markup: keyboard });
				return;
			}

			// Usuario nuevo
			await userService.createUser({
				telegram_id: ctx.from.id,
				username: ctx.from.username || ctx.from.first_name || "Unknown",
				is_approved: false,
				approval_requested: false,
				is_active: true,
				is_admin: false,
				trello_token: null,
				trello_username: null,
				trello_member_id: null,
				default_board_id: null,
				default_list_id: null,
				default_board_name: null,
				default_list_name: null,
				waiting_for_token: false,
				language_code: ctx.from.language_code || "es",
				timezone_offset: 60,
				timezone_last_updated: new Date().toISOString(),
			});

			const keyboard = new InlineKeyboard().text("Request Approval 🔑", "request_approval");
			await ctx.reply(messages.welcome.newUser, { reply_markup: keyboard });
		} catch (error) {
			console.error("Error in start command:", error);
			await ctx.reply(messages.errors.generic);
		}
	});

	// Manejador para el botón de solicitud
	bot.callbackQuery("request_approval", async (ctx) => {
		try {
			if (!ctx.from) {
				await ctx.reply(messages.errors.noUser);
				return;
			}

			const user = await userService.getUserByTelegramId(ctx.from.id);
			if (!user) {
				await ctx.answerCallbackQuery("User not found");
				return;
			}

			if (user.approval_requested) {
				await ctx.answerCallbackQuery("Request already sent");
				return;
			}

			// Actualizar estado y notificar al admin
			await userService.requestApproval(ctx.from.id);
			await ctx.answerCallbackQuery("Request sent successfully!");

			// Actualizar el mensaje con el nuevo estado
			const keyboard = new InlineKeyboard().text("Request Sent ⌛", "request_approval");
			await ctx.editMessageReplyMarkup({ reply_markup: keyboard });

			// Notificar a los admins
			await userService.notifyAdmins(
				ctx.api,
				messages.admin.newRequest(user.username, user.telegram_id),
				user.telegram_id
			);
		} catch (error) {
			console.error("Error in request approval:", error);
			await ctx.answerCallbackQuery("Error processing request");
		}
	});
}
