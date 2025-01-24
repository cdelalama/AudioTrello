declare global {
	// User table
	interface User {
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
	}

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

export {};
