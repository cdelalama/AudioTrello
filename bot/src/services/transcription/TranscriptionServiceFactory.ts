import { TranscriptionService } from "./TranscriptionService";
import { WhisperTranscriptionService } from "./WhisperTranscriptionService";
import { GoogleTranscriptionService } from "./GoogleTranscriptionService";

export type TranscriptionProvider = "whisper" | "google";

export class TranscriptionServiceFactory {
	private static instances: Map<TranscriptionProvider, TranscriptionService> = new Map();

	static getService(provider: TranscriptionProvider = "whisper"): TranscriptionService {
		if (!this.instances.has(provider)) {
			switch (provider) {
				case "google":
					this.instances.set(provider, new GoogleTranscriptionService());
					break;
				case "whisper":
				default:
					this.instances.set(provider, new WhisperTranscriptionService());
					break;
			}
		}
		return this.instances.get(provider)!;
	}

	static async validateServices(): Promise<void> {
		try {
			await Promise.all([
				WhisperTranscriptionService.validateConnection(),
				GoogleTranscriptionService.validateConnection(),
			]);
		} catch (error) {
			console.error("Error validating transcription services:", error);
			// No lanzamos el error para que el bot siga funcionando
		}
	}
}
