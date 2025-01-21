"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionServiceFactory = void 0;
const WhisperTranscriptionService_1 = require("./WhisperTranscriptionService");
const GoogleTranscriptionService_1 = require("./GoogleTranscriptionService");
class TranscriptionServiceFactory {
    static getService(provider = "whisper") {
        if (!this.instances.has(provider)) {
            switch (provider) {
                case "google":
                    this.instances.set(provider, new GoogleTranscriptionService_1.GoogleTranscriptionService());
                    break;
                case "whisper":
                default:
                    this.instances.set(provider, new WhisperTranscriptionService_1.WhisperTranscriptionService());
                    break;
            }
        }
        return this.instances.get(provider);
    }
    static async validateServices() {
        try {
            await Promise.all([
                WhisperTranscriptionService_1.WhisperTranscriptionService.validateConnection(),
                GoogleTranscriptionService_1.GoogleTranscriptionService.validateConnection(),
            ]);
        }
        catch (error) {
            console.error("Error validating transcription services:", error);
            // No lanzamos el error para que el bot siga funcionando
        }
    }
}
exports.TranscriptionServiceFactory = TranscriptionServiceFactory;
TranscriptionServiceFactory.instances = new Map();
