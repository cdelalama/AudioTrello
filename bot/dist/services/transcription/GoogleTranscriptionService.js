"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleTranscriptionService = void 0;
const speech_1 = require("@google-cloud/speech");
const config_1 = require("../../config");
class GoogleTranscriptionService {
    constructor() {
        this.client = new speech_1.SpeechClient();
    }
    async transcribe(audioBuffer) {
        try {
            const audio = {
                content: audioBuffer.toString("base64"),
            };
            const config = {
                encoding: "OGG_OPUS",
                sampleRateHertz: 48000,
                languageCode: "es-ES",
            };
            const request = {
                audio: audio,
                config: config,
            };
            const [response] = await this.client.recognize(request);
            const transcription = response.results
                ?.map((result) => result.alternatives?.[0]?.transcript)
                .join("\n");
            return transcription || "";
        }
        catch (error) {
            console.error("Error transcribing with Google:", error);
            throw new Error("Failed to transcribe audio with Google Speech-to-Text");
        }
    }
    static async validateConnection() {
        try {
            if (!config_1.config.google.available) {
                console.log("❌ Google Speech: not configured");
                return false;
            }
            const credentialsPath = config_1.config.google.credentials;
            if (!credentialsPath || !require("fs").existsSync(credentialsPath)) {
                console.log("❌ Google Speech: credentials file not found");
                return false;
            }
            const client = new speech_1.SpeechClient();
            await client.initialize();
            console.log("✅ Google Speech: ready");
            return true;
        }
        catch (error) {
            console.log("❌ Google Speech: invalid credentials");
            return false;
        }
    }
}
exports.GoogleTranscriptionService = GoogleTranscriptionService;
