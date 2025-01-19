"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdminCommands = setupAdminCommands;
const userService_1 = require("../services/userService");
function setupAdminCommands(bot) {
    // Approve command
    bot.command("approve", async (ctx) => {
        try {
            const admin = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!admin?.is_admin) {
                await ctx.reply("❌ Only admins can approve users");
                return;
            }
            if (!ctx.message) {
                await ctx.reply("❌ Invalid command format");
                return;
            }
            const userId = ctx.message.text.split(" ")[1];
            if (!userId) {
                await ctx.reply("❌ Please provide a Telegram ID to approve");
                return;
            }
            const approved = await userService_1.userService.approveUser(Number(userId));
            if (approved) {
                await ctx.reply("✅ User approved successfully");
            }
            else {
                await ctx.reply("❌ Error approving user");
            }
        }
        catch (error) {
            console.error("Error in approve command:", error);
            await ctx.reply("⚠️ An error occurred while approving user");
        }
    });
    // Ban command
    bot.command("ban", async (ctx) => {
        try {
            const admin = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!admin?.is_admin) {
                await ctx.reply("❌ Only admins can ban users");
                return;
            }
            if (!ctx.message) {
                await ctx.reply("❌ Invalid command format");
                return;
            }
            const userId = ctx.message.text.split(" ")[1];
            if (!userId) {
                await ctx.reply("❌ Please provide a Telegram ID to ban/unban");
                return;
            }
            const banned = await userService_1.userService.toggleBan(Number(userId));
            if (banned) {
                await ctx.reply("✅ User ban status toggled successfully");
            }
            else {
                await ctx.reply("❌ Error toggling user ban status");
            }
        }
        catch (error) {
            console.error("Error in ban command:", error);
            await ctx.reply("⚠️ An error occurred while banning user");
        }
    });
    // Pending command
    bot.command("pending", async (ctx) => {
        try {
            const admin = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!admin?.is_admin) {
                await ctx.reply("❌ Only admins can check pending users");
                return;
            }
            const pendingUsers = await userService_1.userService.getPendingUsers();
            if (pendingUsers.length === 0) {
                await ctx.reply("✅ No pending users to approve");
                return;
            }
            const message = pendingUsers
                .map((user) => `👤 User: ${user.username}\n` +
                `🆔 ID: ${user.telegram_id}\n` +
                `📅 Requested: ${new Date(user.created_at).toLocaleString()}\n`)
                .join("\n");
            await ctx.reply(`🔍 Pending Users (${pendingUsers.length}):\n\n${message}\n\nUse /approve <ID> to approve a user`);
        }
        catch (error) {
            console.error("Error in pending command:", error);
            await ctx.reply("⚠️ An error occurred while fetching pending users");
        }
    });
    // Manejadores para los botones de aprobación
    bot.callbackQuery(/^user_(.+)_(\d+)$/, async (ctx) => {
        try {
            if (!ctx.from || !ctx.match)
                return;
            // Verificar que quien pulsa es admin
            const admin = await userService_1.userService.getUserByTelegramId(ctx.from.id);
            if (!admin?.is_admin) {
                await ctx.answerCallbackQuery("⚠️ Only admins can perform this action");
                return;
            }
            const [, action, userId] = ctx.match;
            const telegramId = parseInt(userId);
            switch (action) {
                case "accept":
                    await userService_1.userService.approveUser(telegramId);
                    await ctx.api.sendMessage(telegramId, "✅ Your account has been approved!");
                    await ctx.editMessageText("User approved ✅");
                    break;
                case "reject":
                    await userService_1.userService.toggleBan(telegramId);
                    await ctx.api.sendMessage(telegramId, "❌ Your request has been rejected.");
                    await ctx.editMessageText("User rejected ❌");
                    break;
                case "cancel":
                    await ctx.editMessageText("Action cancelled ⏳");
                    break;
            }
            await ctx.answerCallbackQuery();
        }
        catch (error) {
            console.error("Error in admin action:", error);
            await ctx.answerCallbackQuery("Error processing action");
        }
    });
}
