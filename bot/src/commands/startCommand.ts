import { Bot, Keyboard } from "grammy";
import { userService } from "../services/userService";
import { messages } from "../messages";
import { helpMessages } from "../messages/helpMessages";

export function setupStartCommand(bot: Bot) {
	bot.command("start", async (ctx) => {
		try {
			const user = ctx.from;
			if (!user) {
				await ctx.reply(messages.errors.noUser);
				return;
			}

			// Verificar si está baneado
			if (await userService.isBanned(user.id)) {
				await ctx.reply(messages.errors.banned);
				return;
			}

			// Check if user exists
			const existingUser = await userService.getUserByTelegramId(user.id);

			if (!existingUser) {
				// Try to register as admin first
				const registeredAsAdmin = await userService.registerInitialAdmin(
					user.id,
					user.username || user.first_name
				);

				if (registeredAsAdmin) {
					await ctx.reply(messages.welcome.adminCreated);
					await ctx.reply(helpMessages.start + "\n\n" + helpMessages.admin, {
						parse_mode: "Markdown",
					});
					return;
				}

				// If not admin, register as normal user
				const registered = await userService.registerUser(
					user.id,
					user.username || user.first_name
				);

				if (registered) {
					const keyboard = new Keyboard().text(messages.welcome.requestButton).resized();
					await ctx.reply(messages.welcome.newUser, { reply_markup: keyboard });
					await ctx.reply(helpMessages.start, { parse_mode: "Markdown" });

					// Notify admins
					await userService.notifyAdmins(
						bot,
						messages.admin.newRequest(user.username || user.first_name, user.id)
					);
				} else {
					await ctx.reply(messages.errors.registration);
				}
			} else if (!existingUser.is_approved) {
				await ctx.reply(messages.welcome.alreadyRequested);
			} else {
				await ctx.reply(messages.welcome.approved);
				await ctx.reply(
					helpMessages.start + (existingUser.is_admin ? "\n\n" + helpMessages.admin : ""),
					{
						parse_mode: "Markdown",
					}
				);
			}
		} catch (error) {
			console.error("Error in start command:", error);
			await ctx.reply("⚠️ An error occurred. Please try again later.");
		}
	});
}
