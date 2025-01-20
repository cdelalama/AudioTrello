"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = void 0;
const supabaseClient_1 = require("./supabaseClient");
exports.configService = {
    async getTranscriptionConfig() {
        try {
            const { data, error } = await supabaseClient_1.supabase
                .from("config")
                .select("value")
                .eq("key", "transcription")
                .single();
            if (error?.code === "PGRST116") {
                // No data found
                console.log("No config found, creating default...");
                const defaultConfig = {
                    services: [
                        { name: "whisper", enabled: true, order: 1 },
                        { name: "google", enabled: true, order: 2 },
                    ],
                    fallbackEnabled: true,
                };
                await this.updateTranscriptionConfig(defaultConfig);
                return defaultConfig;
            }
            if (error)
                throw error;
            // Migrar configuración antigua si es necesario
            const oldConfig = data.value;
            if (!oldConfig.services) {
                console.log("Migrating old config format...");
                const newConfig = {
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
            return data.value;
        }
        catch (error) {
            console.error("Error accessing config:", error);
            throw error;
        }
    },
    async getPrimaryService() {
        const config = await this.getTranscriptionConfig();
        const enabledServices = config.services
            .filter((s) => s.enabled)
            .sort((a, b) => a.order - b.order);
        if (!enabledServices.length) {
            throw new Error("No transcription services enabled");
        }
        return enabledServices[0].name;
    },
    async getFallbackServices() {
        const config = await this.getTranscriptionConfig();
        if (!config.fallbackEnabled)
            return [];
        return config.services
            .filter((s) => s.enabled)
            .sort((a, b) => a.order - b.order)
            .slice(1)
            .map((s) => s.name);
    },
    async updateTranscriptionConfig(config) {
        const { error } = await supabaseClient_1.supabase
            .from("config")
            .update({ value: config })
            .eq("key", "transcription");
        if (error)
            throw error;
    },
};
