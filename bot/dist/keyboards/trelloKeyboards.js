"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBoardsKeyboard = createBoardsKeyboard;
exports.createListsKeyboard = createListsKeyboard;
const grammy_1 = require("grammy");
function createBoardsKeyboard(boards, page = 0) {
    const ITEMS_PER_PAGE = 5;
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentBoards = boards.slice(start, end);
    const keyboard = new grammy_1.InlineKeyboard();
    currentBoards.forEach((board) => {
        keyboard.text(board.name, `select_board:${board.id}`).row();
    });
    // Añadir navegación si hay más páginas
    if (boards.length > ITEMS_PER_PAGE) {
        const buttons = [];
        if (page > 0)
            buttons.push({ text: "⬅️ Anterior", callback_data: `boards_page:${page - 1}` });
        if (end < boards.length)
            buttons.push({ text: "➡️ Siguiente", callback_data: `boards_page:${page + 1}` });
        if (buttons.length > 0)
            keyboard.row(...buttons);
    }
    keyboard.row().text("❌ Cancelar", "settings_cancel");
    return keyboard;
}
function createListsKeyboard(lists, page = 0) {
    const ITEMS_PER_PAGE = 5;
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentLists = lists.slice(start, end);
    const keyboard = new grammy_1.InlineKeyboard();
    currentLists.forEach((list) => {
        keyboard.text(list.name, `select_list:${list.id}`).row();
    });
    // Añadir navegación si hay más páginas
    if (lists.length > ITEMS_PER_PAGE) {
        const buttons = [];
        if (page > 0)
            buttons.push({ text: "⬅️ Anterior", callback_data: `lists_page:${page - 1}` });
        if (end < lists.length)
            buttons.push({ text: "➡️ Siguiente", callback_data: `lists_page:${page + 1}` });
        if (buttons.length > 0)
            keyboard.row(...buttons);
    }
    keyboard.row().text("❌ Cancelar", "settings_cancel");
    return keyboard;
}
