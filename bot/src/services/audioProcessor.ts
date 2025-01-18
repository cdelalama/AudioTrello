import { config } from "../config";
import { configService } from "./configService";
import { TranscriptionServiceFactory } from "./transcription/TranscriptionServiceFactory";

export class AudioProcessor {
	static async processAudioFile(file: any): Promise<string> {
		try {
			const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
			const response = await fetch(fileUrl);
			const buffer = await response.arrayBuffer();
			const audioBuffer = Buffer.from(buffer);

			// Intentar con el servicio primario
			const primaryServiceName = await configService.getPrimaryService();
			const primaryService = TranscriptionServiceFactory.getService(primaryServiceName);
			try {
				return await primaryService.transcribe(audioBuffer);
			} catch (error) {
				console.log(`${primaryServiceName} transcription failed, trying fallback...`);

				const fallbackServices = await configService.getFallbackServices();
				if (!fallbackServices.length) {
					throw error;
				}

				// Intentar con el primer fallback disponible
				const fallbackService = TranscriptionServiceFactory.getService(fallbackServices[0]);
				return await fallbackService.transcribe(audioBuffer);
			}
		} catch (error) {
			console.error("Error processing audio:", error);
			throw new Error("Failed to process audio");
		}
	}
}
