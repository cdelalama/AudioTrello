import { TaskDuration, TaskPriority } from "../../types/types";

export function formatDuration(duration: TaskDuration): string {
	const formats = {
		quick_task: "⚡ Muy rápida (< 4h)",
		short_task: "🕐 Corta (1 día)",
		medium_task: "📅 Media (hasta 5 días)",
		extended_task: "📆 Larga (> 5 días)",
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
