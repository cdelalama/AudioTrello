"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDuration = formatDuration;
exports.formatPriority = formatPriority;
function formatDuration(duration) {
    const formats = {
        quick_task: "⚡ Muy rápida (< 4h)",
        short_task: "🕐 Corta (1 día)",
        medium_task: "📅 Media (hasta 5 días)",
        extended_task: "📆 Larga (> 5 días)",
    };
    return formats[duration];
}
function formatPriority(priority) {
    const formats = {
        high: "🔴 Alta",
        medium: "🟡 Media",
        low: "🟢 Baja",
    };
    return formats[priority];
}
