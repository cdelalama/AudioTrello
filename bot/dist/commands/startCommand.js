"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStartCommand = setupStartCommand;
const grammy_1 = require("grammy");
const userService_1 = require("../services/userService");
const messages_1 = require("../messages/messages");
function setupStartCommand(bot) {
    bot.command("start", async (ctx) => {
        try {
            if (!ctx.from) {
                await ctx.reply(messages_1.messages.errors.noUser);
                return;
            }
            const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
            // Primero verificar si está baneado
            if (user && !user.is_active) {
                await ctx.reply(messages_1.messages.welcome.banned);
                return;
            }
            // Si el usuario ya está aprobado
            if (user?.is_approved) {
                await ctx.reply(messages_1.messages.welcome.approved);
                return;
            }
            // Si el usuario existe pero no está aprobado
            if (user) {
                if (user.approval_requested) {
                    await ctx.reply(messages_1.messages.welcome.alreadyRequested);
                    return;
                }
                const keyboard = new grammy_1.InlineKeyboard().text("Request Approval 🔑", "request_approval");
                await ctx.reply(messages_1.messages.welcome.notApproved, { reply_markup: keyboard });
                return;
            }
            // Usuario nuevo
            await userService_1.userService.createUser({
                telegram_id: ctx.from.id,
                username: ctx.from.username || ctx.from.first_name || "Unknown",
                is_approved: false,
                approval_requested: false,
                is_active: true,
                is_admin: false,
                trello_token: null,
                trello_username: null,
                default_board_id: null,
                default_list_id: null,
            });
            const keyboard = new grammy_1.InlineKeyboard().text("Request Approval 🔑", "request_approval");
            await ctx.reply(messages_1.messages.welcome.newUser, { reply_markup: keyboard });
        }
        catch (error) {
            console.error("Error in start command:", error);
            await ctx.reply(messages_1.messages.errors.generic);
        }
    });
    // Manejador para el botón de solicitud
    bot.callbackQuery("request_approval", async (ctx) => {
        try {
            if (!ctx.from) {
                await ctx.reply(messages_1.messages.errors.noUser);
                return;
            }
            const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
            if (!user) {
                await ctx.answerCallbackQuery("User not found");
                return;
            }
            if (user.approval_requested) {
                await ctx.answerCallbackQuery("Request already sent");
                return;
            }
            // Actualizar estado y notificar al admin
            await userService_1.userService.requestApproval(ctx.from.id);
            await ctx.answerCallbackQuery("Request sent successfully!");
            // Actualizar el mensaje con el nuevo estado
            const keyboard = new grammy_1.InlineKeyboard().text("Request Sent ⌛", "request_approval");
            await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
            // Notificar a los admins
            await userService_1.userService.notifyAdmins(ctx.api, messages_1.messages.admin.newRequest(user.username, user.telegram_id), user.telegram_id);
        }
        catch (error) {
            console.error("Error in request approval:", error);
            await ctx.answerCallbackQuery("Error processing request");
        }
    });
}
