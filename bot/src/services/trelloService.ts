import { config } from "../config";
import { TrelloTaskData } from "../../types/types";
import { User } from "../../types/types";

export class TrelloService {
	private static baseUrl = "https://api.trello.com/1";
	private static key = config.trello.apiKey;

	// Create a card in Trello
	static async createCard(taskData: TrelloTaskData, user: User): Promise<any> {
		if (!user.trello_token) {
			throw new Error("TRELLO_AUTH_REQUIRED");
		}

		try {
			const url = `${this.baseUrl}/cards`;
			const params = new URLSearchParams({
				key: this.key,
				token: user.trello_token,
				idList: user.default_list_id || config.trello.defaultListId,
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
		} catch (error) {
			console.error("Error in createCard:", error);
			throw error;
		}
	}

	static getAuthUrl(): string {
		return `https://trello.com/1/authorize?expiration=never&name=AudioTrello&scope=read,write&response_type=token&key=${this.key}`;
	}

	static async getBoards(userToken: string): Promise<Array<{ id: string; name: string }>> {
		const url = `${this.baseUrl}/members/me/boards`;
		const params = new URLSearchParams({
			key: this.key,
			token: userToken,
			fields: "name,id",
		});

		const response = await fetch(`${url}?${params.toString()}`);
		if (!response.ok) {
			throw new Error(`Error getting boards: ${response.statusText}`);
		}

		return await response.json();
	}

	static async getLists(
		boardId: string,
		userToken: string
	): Promise<Array<{ id: string; name: string }>> {
		const url = `${this.baseUrl}/boards/${boardId}/lists`;
		const params = new URLSearchParams({
			key: this.key,
			token: userToken,
			fields: "name,id",
		});

		const response = await fetch(`${url}?${params.toString()}`);
		if (!response.ok) {
			throw new Error(`Error getting lists: ${response.statusText}`);
		}

		return await response.json();
	}
}
