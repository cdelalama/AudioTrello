export interface TranscriptionService {
	transcribe(audioBuffer: Buffer, filename?: string): Promise<string>;
}
