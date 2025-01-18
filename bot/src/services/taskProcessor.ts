import { TrelloTaskData, TaskDuration, TaskPriority } from "../../types/types";
import { OpenAI } from "openai";
import { config } from "../config";
import { supabase } from "./supabaseClient";

export class TaskProcessor {
	// Tiempo de expiración para tareas pendientes (1 hora)
	private static TASK_EXPIRATION = 60 * 60 * 1000;

	// Método para almacenar una tarea y obtener su ID
	static async storePendingTask(task: TrelloTaskData, userId: number): Promise<string> {
		const expiresAt = new Date(Date.now() + this.TASK_EXPIRATION);

		const { data, error } = await supabase
			.from("pending_tasks")
			.insert({
				task_data: task,
				user_id: userId,
				expires_at: expiresAt.toISOString(),
			})
			.select("id")
			.single();

		if (error) throw error;
		return data.id;
	}

	// Método para recuperar una tarea sin eliminarla
	static async getActivePendingTask(
		taskId: string,
		userId: number
	): Promise<TrelloTaskData | null> {
		const { data, error } = await supabase
			.from("pending_tasks")
			.select("task_data")
			.eq("id", taskId)
			.eq("user_id", userId)
			.gt("expires_at", new Date().toISOString())
			.single();

		if (error) return null;
		return data?.task_data;
	}

	// Método para limpiar tareas expiradas (puede ejecutarse periódicamente)
	static async cleanupExpiredTasks(): Promise<void> {
		await supabase.from("pending_tasks").delete().lt("expires_at", new Date().toISOString());
	}

	private static getOpenAIClient() {
		if (!config.openai.apiKey) {
			throw new Error("OpenAI API key is not configured");
		}
		return new OpenAI({ apiKey: config.openai.apiKey! });
	}

	private static readonly SYSTEM_PROMPT = `
    You are a task analyzer. You receive transcribed audio messages in Spanish and extract task information.

    Analyze if the audio contains a valid task. A valid task should have:
    - A clear action or objective
    - Enough context to understand what needs to be done

    If the input is NOT a valid task (too short, unclear, or just testing), respond with:
    {
      "isValidTask": false,
      "message": "Un mensaje en español explicando por qué no es válido y qué necesita el usuario proporcionar"
    }

    If it IS a valid task, analyze and respond with:
    {
      "isValidTask": true,
      "task": {
        "title": "string",
        "description": "string",
        "duration": "quick_task|short_task|medium_task|extended_task",
        "priority": "high|medium|low",
        "assignedTo": "string?"
      },
      "summary": "Un resumen en español de cómo se interpretó la tarea"
    }
  `;

	private static readonly MERGE_PROMPT = `
    You are a task merger. You receive the original task and additional information in Spanish.
    Combine them intelligently into a single coherent task.

    You MUST respond with a JSON object in this exact format:
    {
      "task": {
        "title": "string",
        "description": "string",
        "duration": "quick_task|short_task|medium_task|extended_task",
        "priority": "high|medium|low"
      },
      "summary": "string describing what was updated in Spanish"
    }

    Example response:
    {
      "task": {
        "title": "Cambiar sábanas del dormitorio",
        "description": "Cambiar las sábanas del dormitorio de Laura en lugar del dormitorio principal",
        "duration": "quick_task",
        "priority": "medium"
      },
      "summary": "Se actualizó la ubicación de la tarea del dormitorio principal al dormitorio de Laura"
    }
  `;

	static async processTranscription(
		transcription: string,
		userId: string
	): Promise<{
		taskData?: TrelloTaskData;
		summary?: string;
		isValidTask: boolean;
		message?: string;
	}> {
		try {
			const openai = this.getOpenAIClient();
			const completion = await openai.chat.completions.create({
				model: "gpt-4",
				messages: [
					{ role: "system", content: this.SYSTEM_PROMPT },
					{ role: "user", content: transcription },
				],
			});

			if (!completion.choices?.[0]?.message?.content) {
				throw new Error("Empty response from OpenAI");
			}

			const content = completion.choices[0].message.content;
			let result;
			try {
				result = JSON.parse(content);
			} catch (error) {
				console.error("Error parsing OpenAI response:", content);
				throw new Error("Invalid JSON response from OpenAI");
			}

			if (!result.isValidTask) {
				return {
					isValidTask: false,
					message: result.message,
				};
			}

			const taskData: TrelloTaskData = {
				title: result.task.title,
				description: result.task.description,
				duration: result.task.duration || "medium_task",
				priority: result.task.priority || "medium",
				assignedTo: result.task.assignedTo || userId,
			};

			return {
				isValidTask: true,
				taskData,
				summary: result.summary,
			};
		} catch (error) {
			console.error("Error processing transcription:", error);
			throw new Error("Failed to process task transcription");
		}
	}

	private static getPriorityColor(priority: TaskPriority): string {
		const colors = {
			high: "red",
			medium: "yellow",
			low: "green",
		};
		return colors[priority];
	}

	static async appendToExistingTask(
		existingTaskId: number,
		newTranscription: string,
		userId: string
	): Promise<{
		taskData: TrelloTaskData;
		summary: string;
	}> {
		const existingTask = await this.getActivePendingTask(
			existingTaskId.toString(),
			parseInt(userId)
		);
		if (!existingTask) throw new Error("Task not found");

		const openai = this.getOpenAIClient();
		const completion = await openai.chat.completions.create({
			model: "gpt-4",
			messages: [
				{ role: "system", content: this.MERGE_PROMPT },
				{
					role: "user",
					content: JSON.stringify({
						original: existingTask,
						additional: newTranscription,
					}),
				},
			],
		});

		if (!completion.choices?.[0]?.message?.content) {
			throw new Error("Empty response from OpenAI");
		}

		const result = JSON.parse(completion.choices[0].message.content);
		const combinedTask: TrelloTaskData = {
			...result.task,
			assignedTo: existingTask.assignedTo,
		};

		await supabase
			.from("pending_tasks")
			.update({ task_data: combinedTask })
			.eq("id", existingTaskId);

		return {
			taskData: combinedTask,
			summary: result.summary,
		};
	}

	static async getRecentPendingTask(
		userId: number
	): Promise<{ id: number; task_data: TrelloTaskData } | null> {
		const { data, error } = await supabase
			.from("pending_tasks")
			.select("id, task_data")
			.eq("user_id", userId)
			.gt("expires_at", new Date().toISOString())
			.order("created_at", { ascending: false })
			.limit(1)
			.single();

		if (error) return null;
		return data;
	}

	// Método para recuperar y eliminar una tarea
	static async getPendingTask(taskId: string, userId: number): Promise<TrelloTaskData | null> {
		const task = await this.getActivePendingTask(taskId, userId);
		if (task) {
			await supabase.from("pending_tasks").delete().eq("id", taskId);
		}
		return task;
	}
}
