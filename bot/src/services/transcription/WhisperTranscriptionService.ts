import OpenAI from "openai";
import { TranscriptionService } from "./TranscriptionService";
import { config } from "../../config";
import fs from "fs";

export class WhisperTranscriptionService implements TranscriptionService {
	private openai: OpenAI;

	constructor() {
		this.openai = new OpenAI({
			apiKey: config.openai.apiKey,
		});
	}

	async transcribe(audioBuffer: Buffer): Promise<string> {
		try {
			// Crear un archivo temporal con nombre único
			const tempFile = `audio_${Date.now()}.ogg`;
			await fs.promises.writeFile(tempFile, audioBuffer);

			const response = await this.openai.audio.transcriptions.create({
				file: fs.createReadStream(tempFile),
				model: "whisper-1",
				language: "es",
				response_format: "text",
			});

			// Limpiar archivo temporal
			await fs.promises.unlink(tempFile);

			return response;
		} catch (error) {
			console.error("Error transcribing with Whisper:", error);
			throw new Error("Failed to transcribe audio with Whisper");
		}
	}

	static async validateConnection(): Promise<boolean> {
		try {
			if (!config.openai.available) {
				console.log("❌ OpenAI Whisper: not configured");
				return false;
			}
			const openai = new OpenAI({ apiKey: config.openai.apiKey });
			await openai.models.list();
			console.log("✅ OpenAI Whisper: ready");
			return true;
		} catch (error) {
			console.log("❌ OpenAI Whisper: invalid credentials");
			return false;
		}
	}
}
