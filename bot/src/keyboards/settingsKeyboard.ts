import { InlineKeyboard } from "grammy";

export const settingsKeyboard = new InlineKeyboard()
	.text("📋 Configurar Tablero", "settings_board")
	.text("📑 Configurar Lista", "settings_list")
	.row()
	.text("🔄 Ver Configuración", "settings_view");
