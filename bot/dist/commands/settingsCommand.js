"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSettingsCommand = setupSettingsCommand;
const settingsKeyboard_1 = require("../keyboards/settingsKeyboard");
const trelloKeyboards_1 = require("../keyboards/trelloKeyboards");
const userService_1 = require("../services/userService");
const trelloService_1 = require("../services/trelloService");
function setupSettingsCommand(bot) {
    bot.command("settings", async (ctx) => {
        try {
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user) {
                await ctx.reply("❌ Usuario no encontrado");
                return;
            }
            await ctx.reply("⚙️ Configuración de Trello", {
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
        catch (error) {
            console.error("Error in settings command:", error);
            await ctx.reply("❌ Error al acceder a la configuración");
        }
    });
    // Manejador para ver configuración actual
    bot.callbackQuery("settings_view", async (ctx) => {
        try {
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user) {
                await ctx.answerCallbackQuery("❌ Usuario no encontrado");
                return;
            }
            const message = `🔧 *Configuración Actual*\n\n` +
                `*Tablero:* ${user.default_board_name || "No configurado"}\n` +
                `*Lista:* ${user.default_list_name || "No configurada"}\n` +
                `*Token Trello:* ${user.trello_token ? "✅ Configurado" : "❌ No configurado"}`;
            await ctx.editMessageText(message, {
                parse_mode: "Markdown",
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
        catch (error) {
            console.error("Error viewing settings:", error);
            await ctx.answerCallbackQuery("❌ Error al mostrar la configuración");
        }
    });
    // Manejador para configurar tablero
    bot.callbackQuery("settings_board", async (ctx) => {
        try {
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user?.trello_token) {
                await ctx.editMessageText("❌ Necesitas autenticarte con Trello primero", {
                    reply_markup: settingsKeyboard_1.settingsKeyboard,
                });
                return;
            }
            const boards = await trelloService_1.TrelloService.getBoards(user.trello_token);
            if (!boards.length) {
                await ctx.editMessageText("❌ No se encontraron tableros en tu cuenta de Trello", {
                    reply_markup: settingsKeyboard_1.settingsKeyboard,
                });
                return;
            }
            await ctx.editMessageText("📋 Selecciona un tablero:", {
                reply_markup: (0, trelloKeyboards_1.createBoardsKeyboard)(boards),
            });
        }
        catch (error) {
            console.error("Error getting boards:", error);
            await ctx.editMessageText("❌ Error al obtener los tableros", {
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
    });
    // Manejador para selección de tablero
    bot.callbackQuery(/select_board:(.+)/, async (ctx) => {
        try {
            const boardId = ctx.match[1];
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user?.trello_token)
                return;
            const boards = await trelloService_1.TrelloService.getBoards(user.trello_token);
            const selectedBoard = boards.find((b) => b.id === boardId);
            if (!selectedBoard)
                return;
            await userService_1.userService.updateUser(user.id, {
                default_board_id: boardId,
                default_board_name: selectedBoard.name,
            });
            const lists = await trelloService_1.TrelloService.getLists(boardId, user.trello_token);
            await ctx.editMessageText(`✅ Tablero seleccionado: *${selectedBoard.name}*\n\nAhora selecciona una lista:`, {
                parse_mode: "Markdown",
                reply_markup: (0, trelloKeyboards_1.createListsKeyboard)(lists),
            });
        }
        catch (error) {
            console.error("Error selecting board:", error);
            await ctx.editMessageText("❌ Error al seleccionar el tablero", {
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
    });
    // Manejador para navegación de páginas de tableros
    bot.callbackQuery(/boards_page:(\d+)/, async (ctx) => {
        try {
            const page = parseInt(ctx.match[1]);
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user?.trello_token)
                return;
            const boards = await trelloService_1.TrelloService.getBoards(user.trello_token);
            await ctx.editMessageText("📋 Selecciona un tablero:", {
                reply_markup: (0, trelloKeyboards_1.createBoardsKeyboard)(boards, page),
            });
        }
        catch (error) {
            console.error("Error navigating boards:", error);
            await ctx.answerCallbackQuery("❌ Error al navegar los tableros");
        }
    });
    // Manejador para selección de lista
    bot.callbackQuery(/select_list:(.+)/, async (ctx) => {
        try {
            const listId = ctx.match[1];
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user?.trello_token || !user.default_board_id)
                return;
            const lists = await trelloService_1.TrelloService.getLists(user.default_board_id, user.trello_token);
            const selectedList = lists.find((l) => l.id === listId);
            if (!selectedList)
                return;
            await userService_1.userService.updateUser(user.id, {
                default_list_id: listId,
                default_list_name: selectedList.name,
            });
            await ctx.editMessageText("✅ Configuración guardada:\n\n" +
                `*Tablero:* ${user.default_board_name}\n` +
                `*Lista:* ${selectedList.name}`, {
                parse_mode: "Markdown",
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
        catch (error) {
            console.error("Error selecting list:", error);
            await ctx.editMessageText("❌ Error al seleccionar la lista", {
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
    });
    // Manejador para navegación de páginas de listas
    bot.callbackQuery(/lists_page:(\d+)/, async (ctx) => {
        try {
            const page = parseInt(ctx.match[1]);
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user?.trello_token || !user.default_board_id)
                return;
            const lists = await trelloService_1.TrelloService.getLists(user.default_board_id, user.trello_token);
            await ctx.editMessageText(`✅ Tablero seleccionado: *${user.default_board_name}*\n\nAhora selecciona una lista:`, {
                parse_mode: "Markdown",
                reply_markup: (0, trelloKeyboards_1.createListsKeyboard)(lists, page),
            });
        }
        catch (error) {
            console.error("Error navigating lists:", error);
            await ctx.answerCallbackQuery("❌ Error al navegar las listas");
        }
    });
    // Manejador para cancelar la configuración
    bot.callbackQuery("settings_cancel", async (ctx) => {
        await ctx.editMessageText("⚙️ Configuración de Trello", {
            reply_markup: settingsKeyboard_1.settingsKeyboard,
        });
    });
    // Manejador para configurar lista directamente
    bot.callbackQuery("settings_list", async (ctx) => {
        try {
            const user = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
            if (!user?.trello_token) {
                await ctx.editMessageText("❌ Necesitas autenticarte con Trello primero", {
                    reply_markup: settingsKeyboard_1.settingsKeyboard,
                });
                return;
            }
            if (!user.default_board_id) {
                await ctx.editMessageText("❌ Primero debes seleccionar un tablero", {
                    reply_markup: settingsKeyboard_1.settingsKeyboard,
                });
                return;
            }
            const lists = await trelloService_1.TrelloService.getLists(user.default_board_id, user.trello_token);
            await ctx.editMessageText(`📋 Selecciona una lista del tablero *${user.default_board_name}*:`, {
                parse_mode: "Markdown",
                reply_markup: (0, trelloKeyboards_1.createListsKeyboard)(lists),
            });
        }
        catch (error) {
            console.error("Error getting lists:", error);
            await ctx.editMessageText("❌ Error al obtener las listas", {
                reply_markup: settingsKeyboard_1.settingsKeyboard,
            });
        }
    });
}
