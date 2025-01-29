import { Bot, InlineKeyboard } from "grammy";
import { createBoardsKeyboard, createListsKeyboard } from "../keyboards/trelloKeyboards";
import { userService } from "../services/userService";
import { TrelloService } from "../services/trelloService";
import { createSettingsKeyboard } from "../keyboards/settingsKeyboard";
import { User } from "../../types/types";

export function setupSettingsCommand(bot: Bot) {
	bot.command("settings", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user) {
				await ctx.reply("❌ Usuario no encontrado");
				return;
			}

			await ctx.reply("⚙️ Configuración de Trello", {
				reply_markup: createSettingsKeyboard(user),
			});
		} catch (error) {
			console.error("Error in settings command:", error);
			await ctx.reply("❌ Error al acceder a la configuración");
		}
	});

	// Manejador para ver configuración actual
	bot.callbackQuery("settings_view", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user) {
				await ctx.answerCallbackQuery("❌ Usuario no encontrado");
				return;
			}

			const message =
				`🔧 *Configuración Actual*\n\n` +
				`*Tablero:* ${
					!user.default_board_name ||
					user.default_board_name === null ||
					user.default_board_name === ""
						? "❌ No configurado"
						: user.default_board_name
				}\n` +
				`*Lista:* ${
					!user.default_list_name ||
					user.default_list_name === null ||
					user.default_list_name === ""
						? "❌ No configurado"
						: user.default_list_name
				}\n` +
				`*Token Trello:* ${user.trello_token ? "✅ Configurado" : "❌ No configurado"}`;

			try {
				await ctx.editMessageText(message, {
					parse_mode: "Markdown",
					reply_markup: createSettingsKeyboard(user),
				});
			} catch (editError: any) {
				// Si el error es porque el mensaje es el mismo, solo respondemos con un callback
				if (editError.description?.includes("message is not modified")) {
					await ctx.answerCallbackQuery("✅ Configuración actualizada");
					return;
				}
				throw editError; // Re-lanzar otros errores
			}
		} catch (error) {
			console.error("Error viewing settings:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al mostrar la configuración. Inténtalo de nuevo.", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para configurar tablero
	bot.callbackQuery("settings_board", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user?.trello_token) {
				await ctx.editMessageText("❌ Necesitas autenticarte con Trello primero", {
					reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
				});
				return;
			}

			const boards = await TrelloService.getBoards(user.trello_token);
			if (!boards.length) {
				await ctx.editMessageText("❌ No se encontraron tableros en tu cuenta de Trello", {
					reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
				});
				return;
			}

			await ctx.editMessageText("📋 Selecciona un tablero:", {
				reply_markup: createBoardsKeyboard(boards),
			});
		} catch (error) {
			console.error("Error getting boards:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al obtener los tableros", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para selección de tablero
	bot.callbackQuery(/select_board:(.+)/, async (ctx) => {
		try {
			const boardId = ctx.match[1];
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user?.trello_token) return;

			const boards = await TrelloService.getBoards(user.trello_token);
			const selectedBoard = boards.find((b) => b.id === boardId);
			if (!selectedBoard) return;

			await userService.updateUser(user.id, {
				default_board_id: boardId,
				default_board_name: selectedBoard.name,
			});

			const lists = await TrelloService.getLists(boardId, user.trello_token);
			await ctx.editMessageText(
				`✅ Tablero seleccionado: *${selectedBoard.name}*\n\nAhora selecciona una lista:`,
				{
					parse_mode: "Markdown",
					reply_markup: createListsKeyboard(lists),
				}
			);
		} catch (error) {
			console.error("Error selecting board:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al seleccionar el tablero", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para navegación de páginas de tableros
	bot.callbackQuery(/boards_page:(\d+)/, async (ctx) => {
		try {
			const page = parseInt(ctx.match[1]);
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user?.trello_token) return;

			const boards = await TrelloService.getBoards(user.trello_token);
			await ctx.editMessageText("📋 Selecciona un tablero:", {
				reply_markup: createBoardsKeyboard(boards, page),
			});
		} catch (error) {
			console.error("Error navigating boards:", error);
			await ctx.answerCallbackQuery("❌ Error al navegar los tableros");
		}
	});

	// Manejador para selección de lista
	bot.callbackQuery(/select_list:(.+)/, async (ctx) => {
		try {
			const listId = ctx.match[1];
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user?.trello_token || !user.default_board_id) return;

			const lists = await TrelloService.getLists(user.default_board_id, user.trello_token);
			const selectedList = lists.find((l) => l.id === listId);
			if (!selectedList) return;

			await userService.updateUser(user.id, {
				default_list_id: listId,
				default_list_name: selectedList.name,
			});

			await ctx.editMessageText(
				"✅ Configuración guardada:\n\n" +
					`*Tablero:* ${user.default_board_name}\n` +
					`*Lista:* ${selectedList.name}`,
				{
					parse_mode: "Markdown",
					reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
				}
			);
		} catch (error) {
			console.error("Error selecting list:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al seleccionar la lista", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para cancelar la configuración
	bot.callbackQuery("settings_cancel", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user) {
				await ctx.answerCallbackQuery("❌ Usuario no encontrado");
				return;
			}

			await ctx.editMessageText("⚙️ Configuración de Trello", {
				reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
			});
		} catch (error) {
			console.error("Error in settings cancel:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("⚙️ Configuración de Trello", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para configurar lista directamente
	bot.callbackQuery("settings_list", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user?.trello_token) {
				await ctx.editMessageText("❌ Necesitas autenticarte con Trello primero", {
					reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
				});
				return;
			}

			if (!user.default_board_id) {
				await ctx.editMessageText("❌ Primero debes seleccionar un tablero", {
					reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
				});
				return;
			}

			const lists = await TrelloService.getLists(user.default_board_id, user.trello_token);
			await ctx.editMessageText(
				`📋 Selecciona una lista del tablero *${user.default_board_name}*:`,
				{
					parse_mode: "Markdown",
					reply_markup: createListsKeyboard(lists),
				}
			);
		} catch (error) {
			console.error("Error getting lists:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al obtener las listas", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para desconectar Trello
	bot.callbackQuery("settings_disconnect", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user) {
				await ctx.answerCallbackQuery("❌ Usuario no encontrado");
				return;
			}

			// Preguntar confirmación
			await ctx.editMessageText(
				"⚠️ *¿Estás seguro de que quieres desconectar Trello?*\n\n" +
					"Se eliminarán todas tus configuraciones actuales.",
				{
					parse_mode: "Markdown",
					reply_markup: new InlineKeyboard()
						.text("✅ Sí, desconectar", "settings_disconnect_confirm")
						.text("❌ No, cancelar", "settings_cancel"),
				}
			);
		} catch (error) {
			console.error("Error in disconnect prompt:", error);
			await ctx.answerCallbackQuery("❌ Error al procesar la solicitud");
		}
	});

	// Manejador para confirmar desconexión
	bot.callbackQuery("settings_disconnect_confirm", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user) {
				await ctx.answerCallbackQuery("❌ Usuario no encontrado");
				return;
			}

			const success = await userService.disconnectTrello(user.id);
			if (success) {
				await ctx.editMessageText(
					"✅ Trello desconectado correctamente\n\n" +
						"Se han eliminado todas las configuraciones.",
					{
						reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
					}
				);
			} else {
				await ctx.editMessageText("❌ Error al desconectar Trello", {
					reply_markup: createSettingsKeyboard(user || ({ id: 0 } as User)),
				});
			}
		} catch (error) {
			console.error("Error disconnecting Trello:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al desconectar Trello", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Manejador para conectar Trello
	bot.callbackQuery("settings_connect", async (ctx) => {
		try {
			const user = await userService.getUserByTelegramId(ctx.from?.id || 0);
			if (!user) {
				await ctx.answerCallbackQuery("❌ Usuario no encontrado");
				return;
			}

			const authUrl = TrelloService.getAuthUrl();
			await ctx.editMessageText(
				"🔑 Para conectar con Trello:\n\n" +
					"1. Haz clic en el botón para autorizar\n" +
					"2. Copia el token que te proporciona Trello\n" +
					"3. Pega el token aquí",
				{
					reply_markup: new InlineKeyboard().url("🔗 Autorizar en Trello", authUrl),
				}
			);

			// Marcar usuario como esperando token
			await userService.updateUser(user.id, { waiting_for_token: true });
		} catch (error) {
			console.error("Error in connect prompt:", error);
			const fallbackUser = await userService.getUserByTelegramId(ctx.from?.id || 0);
			await ctx.editMessageText("❌ Error al iniciar conexión con Trello", {
				reply_markup: createSettingsKeyboard(fallbackUser || ({ id: 0 } as User)),
			});
		}
	});

	// Añadir manejador para cerrar
	bot.callbackQuery("close_settings", async (ctx) => {
		await ctx.deleteMessage();
	});
}
