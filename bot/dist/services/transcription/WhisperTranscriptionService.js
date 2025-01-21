"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhisperTranscriptionService = void 0;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../../config");
const fs_1 = __importDefault(require("fs"));
class WhisperTranscriptionService {
    constructor() {
        this.openai = new openai_1.default({
            apiKey: config_1.config.openai.apiKey,
        });
    }
    async transcribe(audioBuffer) {
        try {
            // Crear un archivo temporal con nombre único
            const tempFile = `audio_${Date.now()}.ogg`;
            await fs_1.default.promises.writeFile(tempFile, audioBuffer);
            const response = await this.openai.audio.transcriptions.create({
                file: fs_1.default.createReadStream(tempFile),
                model: "whisper-1",
                language: "es",
                response_format: "text",
            });
            // Limpiar archivo temporal
            await fs_1.default.promises.unlink(tempFile);
            return response;
        }
        catch (error) {
            console.error("Error transcribing with Whisper:", error);
            throw new Error("Failed to transcribe audio with Whisper");
        }
    }
    static async validateConnection() {
        try {
            if (!config_1.config.openai.available) {
                console.log("❌ OpenAI Whisper: not configured");
                return false;
            }
            const openai = new openai_1.default({ apiKey: config_1.config.openai.apiKey });
            await openai.models.list();
            console.log("✅ OpenAI Whisper: ready");
            return true;
        }
        catch (error) {
            console.log("❌ OpenAI Whisper: invalid credentials");
            return false;
        }
    }
}
exports.WhisperTranscriptionService = WhisperTranscriptionService;
