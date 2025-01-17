import { TaskDuration, TaskPriority } from "../../types/types";

export function formatDuration(duration: TaskDuration): string {
	const formats = {
		very_short: "⚡ Muy rápida (< 4h)",
		short: "🕐 Corta (1 día)",
		medium: "📅 Media (hasta 5 días)",
		long: "�� Larga (> 5 días)",
	};
	return formats[duration];
}

export function formatPriority(priority: TaskPriority): string {
	const formats = {
		high: "🔴 Alta",
		medium: "🟡 Media",
		low: "🟢 Baja",
	};
	return formats[priority];
}
