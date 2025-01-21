import { TranscriptionService } from "./TranscriptionService";
import { SpeechClient } from "@google-cloud/speech";
import { config } from "../../config";

export class GoogleTranscriptionService implements TranscriptionService {
	private client: SpeechClient;

	constructor() {
		this.client = new SpeechClient();
	}

	async transcribe(audioBuffer: Buffer): Promise<string> {
		try {
			const audio = {
				content: audioBuffer.toString("base64"),
			};

			const config = {
				encoding: "OGG_OPUS" as const,
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
		} catch (error) {
			console.error("Error transcribing with Google:", error);
			throw new Error("Failed to transcribe audio with Google Speech-to-Text");
		}
	}

	static async validateConnection(): Promise<boolean> {
		try {
			if (!config.google.available) {
				console.log("❌ Google Speech: not configured");
				return false;
			}

			const credentialsPath = config.google.credentials;
			if (!credentialsPath || !require("fs").existsSync(credentialsPath)) {
				console.log("❌ Google Speech: credentials file not found");
				return false;
			}

			const client = new SpeechClient();
			await client.initialize();
			console.log("✅ Google Speech: ready");
			return true;
		} catch (error) {
			console.log("❌ Google Speech: invalid credentials");
			return false;
		}
	}
}
