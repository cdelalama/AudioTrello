import { Bot } from "grammy";
import { userService } from "../services/userService";
import { helpMessages } from "../messages/helpMessages";

export function setupHelpCommand(bot: Bot) {
	bot.command("help", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);

			if (!user || !user.is_approved) {
				await ctx.reply("❌ You need to be registered and approved to use this bot.");
				return;
			}

			// Show base help message to everyone
			let helpMessage = helpMessages.start;

			// Add admin commands only for admins
			if (user.is_admin) {
				helpMessage += "\n\n" + helpMessages.admin;
			}

			await ctx.reply(helpMessage, { parse_mode: "Markdown" });
		} catch (error) {
			console.error("Error in help command:", error);
			await ctx.reply("⚠️ An error occurred while showing help.");
		}
	});
}
