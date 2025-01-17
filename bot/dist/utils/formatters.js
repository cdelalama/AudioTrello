"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDuration = formatDuration;
exports.formatPriority = formatPriority;
function formatDuration(duration) {
    const formats = {
        very_short: "⚡ Muy rápida (< 4h)",
        short: "🕐 Corta (1 día)",
        medium: "📅 Media (hasta 5 días)",
        long: "�� Larga (> 5 días)",
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
