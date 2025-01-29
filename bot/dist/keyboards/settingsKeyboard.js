"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSettingsKeyboard = createSettingsKeyboard;
const grammy_1 = require("grammy");
// Ahora la función recibe el usuario como parámetro
function createSettingsKeyboard(user) {
    const keyboard = new grammy_1.InlineKeyboard();
    if (user.trello_token) {
        // Si tiene token, mostramos opciones de configuración
        keyboard
            .text("📋 Configurar Tablero", "settings_board")
            .text("📑 Configurar Lista", "settings_list")
            .row()
            .text("🔄 Ver Configuración", "settings_view")
            .row()
            .text("❌ Desconectar Trello", "settings_disconnect");
    }
    else {
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
