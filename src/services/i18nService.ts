export class I18nService {
	static async getUserLanguage(userId: number): Promise<string> {
		const user = await userService.getUserByTelegramId(userId);
		return user?.preferred_language || "es";
	}

	static t(key: string, lang: string): string {
		const keys = key.split(".");
		let translation = translations[lang];
		for (const k of keys) {
			translation = translation[k];
		}
		return translation;
	}
}
