"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrelloService = void 0;
const config_1 = require("../config");
class TrelloService {
    // Create a card in Trello
    static async createCard(taskData, user) {
        if (!user.trello_token || !user.default_list_id) {
            throw new Error("TRELLO_AUTH_REQUIRED");
        }
        try {
            const url = `${this.baseUrl}/cards`;
            const params = new URLSearchParams({
                key: this.key,
                token: user.trello_token,
                idList: user.default_list_id,
                name: taskData.title,
                desc: taskData.description,
                pos: "bottom",
            });
            const response = await fetch(`${url}?${params.toString()}`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`Error creating Trello card: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error("Error in createCard:", error);
            throw error;
        }
    }
    static getAuthUrl() {
        return `https://trello.com/1/authorize?expiration=never&name=AudioTrello&scope=read,write&response_type=token&key=${this.key}`;
    }
    static async getBoards(token) {
        const url = `${this.baseUrl}/members/me/boards`;
        const params = new URLSearchParams({
            key: this.key,
            token: token,
            fields: "name",
        });
        const response = await fetch(`${url}?${params}`);
        if (!response.ok)
            throw new Error("Failed to fetch boards");
        return response.json();
    }
    static async getLists(boardId, token) {
        const url = `${this.baseUrl}/boards/${boardId}/lists`;
        const params = new URLSearchParams({
            key: this.key,
            token: token,
            fields: "name",
        });
        const response = await fetch(`${url}?${params}`);
        if (!response.ok)
            throw new Error("Failed to fetch lists");
        return response.json();
    }
}
exports.TrelloService = TrelloService;
TrelloService.baseUrl = "https://api.trello.com/1";
TrelloService.key = config_1.config.trello.apiKey;
