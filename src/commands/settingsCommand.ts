import { settingsTranslations } from "../i18n/translations/settings";

bot.command("settings", async (ctx) => {
	const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
	const lang = user?.preferred_language || "es";
	const t = settingsTranslations[lang];

	await ctx.reply(t.menu.title, {
		reply_markup: createSettingsKeyboard(user, t),
	});
});
