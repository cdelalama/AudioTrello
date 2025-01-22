"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStartCommand = setupStartCommand;
const grammy_1 = require("grammy");
const userService_1 = require("../services/userService");
const messages_1 = require("../messages");
const helpMessages_1 = require("../messages/helpMessages");
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
                    await ctx.reply(helpMessages_1.helpMessages.start + "\n\n" + helpMessages_1.helpMessages.admin, {
                        parse_mode: "Markdown",
                    });
                    return;
                }
                // If not admin, register as normal user
                const registered = await userService_1.userService.registerUser(user.id, user.username || user.first_name);
                if (registered) {
                    const keyboard = new grammy_1.Keyboard().text(messages_1.messages.welcome.requestButton).resized();
                    await ctx.reply(messages_1.messages.welcome.newUser, { reply_markup: keyboard });
                    await ctx.reply(helpMessages_1.helpMessages.start, { parse_mode: "Markdown" });
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
                await ctx.reply(helpMessages_1.helpMessages.start + (existingUser.is_admin ? "\n\n" + helpMessages_1.helpMessages.admin : ""), {
                    parse_mode: "Markdown",
                });
            }
        }
        catch (error) {
            console.error("Error in start command:", error);
            await ctx.reply("⚠️ An error occurred. Please try again later.");
        }
    });
}
