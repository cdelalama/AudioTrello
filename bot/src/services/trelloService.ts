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
}
