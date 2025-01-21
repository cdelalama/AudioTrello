import { supabase } from "./supabaseClient";
import { TranscriptionConfig, TranscriptionServiceName } from "../../types/types";

export const configService = {
	async getTranscriptionConfig(): Promise<TranscriptionConfig> {
		const { data, error } = await supabase
			.from("config")
			.select("value")
			.eq("key", "transcription")
			.single();

		if (error) throw error;

		return data.value as TranscriptionConfig;
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
