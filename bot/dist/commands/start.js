"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStartCommand = setupStartCommand;
const grammy_1 = require("grammy");
const userService_1 = require("../services/userService");
const messages_1 = require("../messages");
function setupStartCommand(bot) {
    bot.command("start", async (ctx) => {
        try {
            const user = ctx.from;
            if (!user) {
                await ctx.reply(messages_1.messages.errors.noUser);
                return;
            }
            // Verificar si está baneado
            if (await userService_1.userService.isBanned(user.id)) {
                await ctx.reply(messages_1.messages.errors.banned);
                return;
            }
            // Check if user exists
            const existingUser = await userService_1.userService.getUserByTelegramId(user.id);
            if (!existingUser) {
                // Try to register as admin first
                const registeredAsAdmin = await userService_1.userService.registerInitialAdmin(user.id, user.username || user.first_name);
                if (registeredAsAdmin) {
                    await ctx.reply(messages_1.messages.welcome.adminCreated);
                    return;
                }
                // If not admin, register as normal user
                const registered = await userService_1.userService.registerUser(user.id, user.username || user.first_name);
                if (registered) {
                    const keyboard = new grammy_1.Keyboard().text(messages_1.messages.welcome.requestButton).resized();
                    await ctx.reply(messages_1.messages.welcome.newUser, { reply_markup: keyboard });
                    // Notify admins
                    await userService_1.userService.notifyAdmins(bot, messages_1.messages.admin.newRequest(user.username || user.first_name, user.id));
                }
                else {
                    await ctx.reply(messages_1.messages.errors.registration);
                }
            }
            else if (!existingUser.is_approved) {
                await ctx.reply(messages_1.messages.welcome.alreadyRequested);
            }
            else {
                await ctx.reply(messages_1.messages.welcome.approved);
            }
        }
        catch (error) {
            console.error("Error in start command:", error);
            await ctx.reply("⚠️ An error occurred. Please try again later.");
        }
    });
}
