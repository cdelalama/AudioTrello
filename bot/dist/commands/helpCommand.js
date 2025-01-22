"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupHelpCommand = setupHelpCommand;
const userService_1 = require("../services/userService");
const helpMessages_1 = require("../messages/helpMessages");
function setupHelpCommand(bot) {
    bot.command("help", async (ctx) => {
        try {
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user || !user.is_approved) {
                await ctx.reply("❌ You need to be registered and approved to use this bot.");
                return;
            }
            // Show base help message to everyone
            let helpMessage = helpMessages_1.helpMessages.start;
            // Add admin commands only for admins
            if (user.is_admin) {
                helpMessage += "\n\n" + helpMessages_1.helpMessages.admin;
            }
            await ctx.reply(helpMessage, { parse_mode: "Markdown" });
        }
        catch (error) {
            console.error("Error in help command:", error);
            await ctx.reply("⚠️ An error occurred while showing help.");
        }
    });
}
