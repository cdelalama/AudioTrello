import { InlineKeyboard } from "grammy";
import { User } from "../../types/types";

// Ahora la función recibe el usuario como parámetro
export function createSettingsKeyboard(user: User): InlineKeyboard {
	const keyboard = new InlineKeyboard();

	if (user.trello_token) {
		// Si tiene token, mostramos opciones de configuración
		keyboard
			.text("📋 Configurar Tablero", "settings_board")
			.text("📑 Configurar Lista", "settings_list")
			.row()
			.text("🔄 Ver Configuración", "settings_view")
			.row()
			.text("❌ Desconectar Trello", "settings_disconnect");
	} else {
		// Si no tiene token, solo mostramos opción de conectar
		keyboard
			.text("🔗 Conectar con Trello", "settings_connect")
			.row()
			.text("🔄 Ver Configuración", "settings_view");
	}

	// Siempre añadir el botón de cerrar al final
	keyboard.row().text("❌ Cerrar", "close_settings");

	return keyboard;
}
