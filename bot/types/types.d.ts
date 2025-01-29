export interface Database {
	public: {
		Tables: {
			users: {
				Row: User; // Return type when querying
				Insert: Omit<User, "id" | "created_at">; // Insert type
				Update: Partial<Omit<User, "id" | "created_at">>; // Update type
			};
			tasks: {
				Row: Task;
				Insert: Omit<Task, "id" | "created_at">;
				Update: Partial<Omit<Task, "id" | "created_at">>;
			};
			config: {
				Row: {
					id: number;
					key: string;
					value: TranscriptionConfig | JsonValue;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					key: string;
					value: TranscriptionConfig | JsonValue;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					key?: string;
					value?: TranscriptionConfig | JsonValue;
					updated_at?: string;
				};
			};
			pending_tasks: {
				Row: PendingTask;
				Insert: Omit<PendingTask, "id">;
				Update: Partial<Omit<PendingTask, "id">>;
			};
		};
	};
}

export interface User {
	id: number;
	telegram_id: number;
	username: string;
	created_at: string;
	is_active: boolean;
	is_admin: boolean; // Para identificar administradores que pueden aprobar usuarios
	is_approved: boolean; // Para saber si el usuario está aprobado para usar el bot
	trello_token: string | null; // Token de acceso a Trello
	trello_username: string | null; // Username de Trello
	default_board_id: string | null; // ID del tablero por defecto
	default_list_id: string | null; // ID de la lista por defecto
	default_board_name: string | null; // Añadir este campo
	default_list_name: string | null; // Añadir este campo
	approval_requested: boolean; // Para saber si ya solicitó aprobación
	waiting_for_token: boolean;
}

declare global {
	// Task table
	interface Task {
		id: number;
		title: string;
		description: string;
		duration_type: "very_short" | "short" | "medium" | "long";
		priority: "high" | "medium" | "low";
		status: "pending" | "in_progress" | "done";
		created_at: string;
		created_by: number; // user.id
		assigned_to: number | null; // user.id
		trello_card_id: string | null;
		audio_url: string | null;
		transcription: string;
	}
}

export type TranscriptionServiceName = "whisper" | "google";

export interface TranscriptionServiceConfig {
	name: TranscriptionServiceName;
	enabled: boolean;
	order: number;
}

export interface TranscriptionConfig {
	services: TranscriptionServiceConfig[];
	fallbackEnabled: boolean;
}

export type TaskDuration = "quick_task" | "short_task" | "medium_task" | "extended_task";
export type TaskPriority = "high" | "medium" | "low";

export interface TrelloTaskData {
	title: string;
	description: string;
	duration: TaskDuration;
	priority: TaskPriority;
	assignedTo?: string; // Opcional, por defecto será el usuario actual
}

export interface PendingTask {
	id: number;
	task_data: TrelloTaskData;
	user_id: number;
	created_at: string;
	expires_at: string;
}

export interface TrelloConfig {
	apiKey: string;
	token: string;
	defaultBoardId: string;
	defaultListId: string;
}

export interface Config {
	botToken: string;
	supabase: {
		url: string;
		anonKey: string;
	};
	openai: {
		apiKey: string;
		available: boolean;
	};
	google: {
		credentials: string;
		projectId: string;
		available: boolean;
	};
	admin: {
		telegramId: string;
	};
	transcription: TranscriptionConfig;
	trello: TrelloConfig;
}

export {};
