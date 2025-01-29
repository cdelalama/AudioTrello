"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsKeyboard = void 0;
const grammy_1 = require("grammy");
exports.settingsKeyboard = new grammy_1.InlineKeyboard()
    .text("📋 Configurar Tablero", "settings_board")
    .text("📑 Configurar Lista", "settings_list")
    .row()
    .text("🔄 Ver Configuración", "settings_view");
