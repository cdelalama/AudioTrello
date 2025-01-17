import { config } from "../config";
import { TrelloTaskData } from "../../types/types";
import { User } from "../../types/types";
import { supabase } from "./supabaseClient";

export class TrelloService {
	private static baseUrl = "https://api.trello.com/1";
	private static key = config.trello.apiKey;

	private static async getOrCreateLabels(boardId: string, token: string) {
		// Get all labels from the board
		const response = await fetch(
			`https://api.trello.com/1/boards/${boardId}/labels?key=${config.trello.apiKey}&token=${token}`
		);
		const existingLabels = await response.json();

		// Define required labels with their colors
		const requiredLabels = {
			// Duration labels
			very_short: { name: "Very Short", color: "green" },
			short: { name: "Short", color: "yellow" },
			medium: { name: "Medium", color: "orange" },
			long: { name: "Long", color: "red" },
			// Priority labels
			high_priority: { name: "⚡ High Priority", color: "red" },
			medium_priority: { name: "● Medium Priority", color: "yellow" },
			low_priority: { name: "○ Low Priority", color: "blue" },
		};

		const labelMap: { [key: string]: string } = {};

		// Create missing labels
		for (const [key, label] of Object.entries(requiredLabels)) {
			const existingLabel = existingLabels.find(
				(l: any) => l.name.toLowerCase() === label.name.toLowerCase()
			);

			if (existingLabel) {
				labelMap[key] = existingLabel.id;
			} else {
				// Create new label
				const createResponse = await fetch(
					`https://api.trello.com/1/boards/${boardId}/labels?key=${config.trello.apiKey}&token=${token}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							name: label.name,
							color: label.color,
						}),
					}
				);
				const newLabel = await createResponse.json();
				labelMap[key] = newLabel.id;
			}
		}

		return labelMap;
	}

	public static async createCard(taskData: any, user: User) {
		if (!user.trello_token || !user.default_board_id || !user.default_list_id) {
			throw new Error("TRELLO_AUTH_REQUIRED");
		}

		// Get or create labels first
		const labelMap = await this.getOrCreateLabels(user.default_board_id, user.trello_token);

		// Get user's Trello member ID if not stored
		let memberId = user.trello_member_id;
		if (!memberId) {
			const memberInfo = await this.getTrelloMemberInfo(user.trello_token);
			await this.updateUserTrelloInfo(user.id, memberInfo.id, memberInfo.username);
			memberId = memberInfo.id;
		}

		// Determine which labels to apply
		const labelsToApply = [];
		labelsToApply.push(labelMap[taskData.duration]);
		labelsToApply.push(labelMap[`${taskData.priority}_priority`]);

		// Create card with labels and member assignment
		const response = await fetch(
			`https://api.trello.com/1/cards?key=${config.trello.apiKey}&token=${user.trello_token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: taskData.title,
					desc: taskData.description,
					idList: user.default_list_id,
					idLabels: labelsToApply,
					idMembers: [memberId],
				}),
			}
		);

		if (!response.ok) {
			const errorData = await response.text();
			console.error("Trello API error:", errorData);
			throw new Error("Failed to create Trello card: " + errorData);
		}

		return await response.json();
	}

	// Nuevo método para obtener información del usuario de Trello
	private static async getTrelloMemberInfo(
		token: string
	): Promise<{ id: string; username: string }> {
		const response = await fetch(
			`https://api.trello.com/1/members/me?key=${this.key}&token=${token}`
		);

		if (!response.ok) {
			throw new Error("Failed to get Trello member info");
		}

		const data = await response.json();
		return {
			id: data.id,
			username: data.username,
		};
	}

	// Nuevo método para actualizar la información del usuario
	private static async updateUserTrelloInfo(
		userId: number,
		trelloId: string,
		trelloUsername: string
	): Promise<void> {
		const { error } = await supabase
			.from("users")
			.update({
				trello_username: trelloUsername,
				trello_member_id: trelloId,
			})
			.eq("id", userId);

		if (error) {
			console.error("Error updating user Trello info:", error);
			throw new Error("Failed to update user Trello info");
		}
	}

	static getAuthUrl(): string {
		return `https://trello.com/1/authorize?expiration=never&name=AudioTrello&scope=read,write&response_type=token&key=${this.key}`;
	}

	static async getBoards(token: string): Promise<Array<{ id: string; name: string }>> {
		const url = `${this.baseUrl}/members/me/boards`;
		const params = new URLSearchParams({
			key: this.key,
			token: token,
			fields: "name",
		});

		const response = await fetch(`${url}?${params}`);
		if (!response.ok) throw new Error("Failed to fetch boards");

		return response.json();
	}

	static async getLists(
		boardId: string,
		token: string
	): Promise<Array<{ id: string; name: string }>> {
		const url = `${this.baseUrl}/boards/${boardId}/lists`;
		const params = new URLSearchParams({
			key: this.key,
			token: token,
			fields: "name",
		});

		const response = await fetch(`${url}?${params}`);
		if (!response.ok) throw new Error("Failed to fetch lists");

		return response.json();
	}

	async disconnectTrello(userId: number): Promise<boolean> {
		try {
			const { error } = await supabase
				.from("users")
				.update({
					trello_token: null,
					trello_username: null,
					trello_member_id: null,
					default_board_id: null,
					default_board_name: null,
					default_list_id: null,
					default_list_name: null,
					waiting_for_token: false,
				})
				.eq("id", userId);

			return !error;
		} catch (error) {
			console.error("Error disconnecting Trello:", error);
			return false;
		}
	}
}
