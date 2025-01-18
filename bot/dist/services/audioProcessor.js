"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioProcessor = void 0;
const config_1 = require("../config");
const configService_1 = require("./configService");
const TranscriptionServiceFactory_1 = require("./transcription/TranscriptionServiceFactory");
class AudioProcessor {
    static async processAudioFile(file) {
        try {
            const fileUrl = `https://api.telegram.org/file/bot${config_1.config.botToken}/${file.file_path}`;
            const response = await fetch(fileUrl);
            const buffer = await response.arrayBuffer();
            const audioBuffer = Buffer.from(buffer);
            // Intentar con el servicio primario
            const primaryServiceName = await configService_1.configService.getPrimaryService();
            const primaryService = TranscriptionServiceFactory_1.TranscriptionServiceFactory.getService(primaryServiceName);
            try {
                return await primaryService.transcribe(audioBuffer);
            }
            catch (error) {
                console.log(`${primaryServiceName} transcription failed, trying fallback...`);
                const fallbackServices = await configService_1.configService.getFallbackServices();
                if (!fallbackServices.length) {
                    throw error;
                }
                // Intentar con el primer fallback disponible
                const fallbackService = TranscriptionServiceFactory_1.TranscriptionServiceFactory.getService(fallbackServices[0]);
                return await fallbackService.transcribe(audioBuffer);
            }
        }
        catch (error) {
            console.error("Error processing audio:", error);
            throw new Error("Failed to process audio");
        }
    }
}
exports.AudioProcessor = AudioProcessor;
