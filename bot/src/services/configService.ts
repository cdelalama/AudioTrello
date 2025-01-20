import { supabase } from "./supabaseClient";
import { TranscriptionConfig, TranscriptionServiceName } from "../../types/types";

export const configService = {
	async getTranscriptionConfig(): Promise<TranscriptionConfig> {
		try {
			const { data, error } = await supabase
				.from("config")
				.select("value")
				.eq("key", "transcription")
				.single();

			if (error?.code === "PGRST116") {
				// No data found
				console.log("No config found, creating default...");
				const defaultConfig: TranscriptionConfig = {
					services: [
						{ name: "whisper", enabled: true, order: 1 },
						{ name: "google", enabled: true, order: 2 },
					],
					fallbackEnabled: true,
				};

				await this.updateTranscriptionConfig(defaultConfig);
				return defaultConfig;
			}

			if (error) throw error;

			// Migrar configuración antigua si es necesario
			const oldConfig = data.value as any;
			if (!oldConfig.services) {
				console.log("Migrating old config format...");
				const newConfig: TranscriptionConfig = {
					services: [
						{ name: oldConfig.primaryService, enabled: true, order: 1 },
						{
							name: oldConfig.primaryService === "whisper" ? "google" : "whisper",
							enabled: true,
							order: 2,
						},
					],
					fallbackEnabled: oldConfig.fallbackEnabled,
				};
				await this.updateTranscriptionConfig(newConfig);
				return newConfig;
			}

			console.log("Config loaded:", data.value);
			return data.value as TranscriptionConfig;
		} catch (error) {
			console.error("Error accessing config:", error);
			throw error;
		}
	},

	async getPrimaryService(): Promise<TranscriptionServiceName> {
		const config = await this.getTranscriptionConfig();
		const enabledServices = config.services
			.filter((s) => s.enabled)
			.sort((a, b) => a.order - b.order);

		if (!enabledServices.length) {
			throw new Error("No transcription services enabled");
		}

		return enabledServices[0].name;
	},

	async getFallbackServices(): Promise<TranscriptionServiceName[]> {
		const config = await this.getTranscriptionConfig();
		if (!config.fallbackEnabled) return [];

		return config.services
			.filter((s) => s.enabled)
			.sort((a, b) => a.order - b.order)
			.slice(1)
			.map((s) => s.name);
	},

	async updateTranscriptionConfig(config: Partial<TranscriptionConfig>): Promise<void> {
		const { error } = await supabase
			.from("config")
			.update({ value: config })
			.eq("key", "transcription");

		if (error) throw error;
	},
};
