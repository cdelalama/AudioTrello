"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = void 0;
const supabaseClient_1 = require("./supabaseClient");
exports.configService = {
    async getTranscriptionConfig() {
        const { data, error } = await supabaseClient_1.supabase
            .from("config")
            .select("value")
            .eq("key", "transcription")
            .single();
        if (error)
            throw error;
        return data.value;
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
