"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskProcessor = void 0;
const openai_1 = require("openai");
const config_1 = require("../config");
const supabaseClient_1 = require("./supabaseClient");
class TaskProcessor {
    // Método para almacenar una tarea y obtener su ID
    static async storePendingTask(task, userId) {
        const expiresAt = new Date(Date.now() + this.TASK_EXPIRATION);
        const { data, error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .insert({
            task_data: task,
            user_id: userId,
            expires_at: expiresAt.toISOString(),
        })
            .select("id")
            .single();
        if (error)
            throw error;
        return data.id;
    }
    // Método para recuperar una tarea sin eliminarla
    static async getActivePendingTask(taskId, userId) {
        const { data, error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .select("task_data")
            .eq("id", taskId)
            .eq("user_id", userId)
            .gt("expires_at", new Date().toISOString())
            .single();
        if (error)
            return null;
        return data?.task_data;
    }
    // Método para limpiar tareas expiradas (puede ejecutarse periódicamente)
    static async cleanupExpiredTasks() {
        await supabaseClient_1.supabase.from("pending_tasks").delete().lt("expires_at", new Date().toISOString());
    }
    static getOpenAIClient() {
        if (!config_1.config.openai.apiKey) {
            throw new Error("OpenAI API key is not configured");
        }
        return new openai_1.OpenAI({ apiKey: config_1.config.openai.apiKey });
    }
    static async processTranscription(transcription, userId) {
        try {
            const openai = this.getOpenAIClient();
            // Crear el prompt con la fecha actual
            const currentDate = new Date();
            const systemPrompt = `
				You are a task analyzer. You receive transcribed audio messages in Spanish and extract task information.
				Be practical and use common sense when analyzing tasks.

				Analyze if the audio contains a valid task. A valid task should have:
				- A clear action or objective (if you can understand what needs to be done, it's clear enough)

				Use common sense for duration based on task complexity:
				- very_short: Simple tasks that take less than an hour
				- short: Tasks that typically take a few hours
				- medium: Tasks that might take several days
				- long: Complex tasks that take weeks

				Use common sense for priority:
				- high: Urgent or time-sensitive tasks
				- medium: Regular, routine tasks
				- low: Optional or non-urgent tasks

				IMPORTANT FOR DATES:
				- Pay special attention to date mentions like "el sábado", "mañana", "la próxima semana", etc.
				- Current date is: ${currentDate.toISOString()}
				- Today is ${currentDate.toLocaleDateString("es-ES", { weekday: "long" })}
				- Convert relative dates to ISO format:
				  * "mañana" -> next day at 10:00
				  * "el sábado" -> next Saturday at 10:00
				  * "la próxima semana" -> next Monday at 10:00
				- If no specific time is mentioned, use 10:00 as default time
				- If no date is mentioned, set dueDate to null

				If it IS a valid task, analyze and respond with:
				{
				  "isValidTask": true,
				  "task": {
					"title": "string",
					"description": "string",
					"duration": "very_short|short|medium|long",
					"priority": "high|medium|low",
					"assignedTo": "string?",
					"dueDate": "ISO date string or null"
				  },
				  "summary": "Un resumen en español de cómo se interpretó la tarea, SIEMPRE mencionar si hay fecha o no"
				}
			`;
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
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
            }
            catch (error) {
                console.error("Error parsing OpenAI response:", content);
                throw new Error("Invalid JSON response from OpenAI");
            }
            if (!result.isValidTask) {
                return {
                    isValidTask: false,
                    message: result.message,
                };
            }
            const taskData = {
                title: result.task.title,
                description: result.task.description,
                duration: result.task.duration || "medium",
                priority: result.task.priority || "medium",
                assignedTo: result.task.assignedTo || userId,
                dueDate: result.task.dueDate,
            };
            return {
                isValidTask: true,
                taskData,
                summary: result.summary,
            };
        }
        catch (error) {
            console.error("Error processing transcription:", error);
            throw new Error("Failed to process task transcription");
        }
    }
    static getPriorityColor(priority) {
        const colors = {
            high: "red",
            medium: "yellow",
            low: "green",
        };
        return colors[priority];
    }
    static async appendToExistingTask(existingTaskId, newTranscription, userId) {
        const existingTask = await this.getActivePendingTask(existingTaskId.toString(), parseInt(userId));
        if (!existingTask)
            throw new Error("Task not found");
        const openai = this.getOpenAIClient();
        const currentDate = new Date();
        const mergePrompt = `
			You are a task merger. You receive the original task and additional information in Spanish.
			Combine them intelligently into a single coherent task.

			IMPORTANT FOR DATES:
			- Current date is: ${currentDate.toISOString()}
			- Today is ${currentDate.toLocaleDateString("es-ES", { weekday: "long" })}
			- If new date is mentioned in the additional information, UPDATE the dueDate
			- If no new date is mentioned, keep the existing dueDate
			- Convert relative dates to ISO format:
			  * "mañana" -> next day at 10:00
			  * "el sábado" -> next Saturday at 10:00
			  * "la próxima semana" -> next Monday at 10:00
			- If no specific time is mentioned, use 10:00 as default time

			You MUST respond with a JSON object in this exact format:
			{
			  "task": {
				"title": "string",
				"description": "string",
				"duration": "very_short|short|medium|long",
				"priority": "high|medium|low",
				"dueDate": "ISO date string or null"
			  },
			  "summary": "string describing what was updated in Spanish, ALWAYS mention if there's a due date or not"
			}
		`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: mergePrompt },
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
        const combinedTask = {
            ...result.task,
            assignedTo: existingTask.assignedTo,
        };
        await supabaseClient_1.supabase
            .from("pending_tasks")
            .update({ task_data: combinedTask })
            .eq("id", existingTaskId);
        return {
            taskData: combinedTask,
            summary: result.summary,
        };
    }
    static async getRecentPendingTask(userId) {
        const { data, error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .select("id, task_data")
            .eq("user_id", userId)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (error)
            return null;
        return data;
    }
    // Método para recuperar y eliminar una tarea
    static async getPendingTask(taskId, userId) {
        const task = await this.getActivePendingTask(taskId, userId);
        if (task) {
            await supabaseClient_1.supabase.from("pending_tasks").delete().eq("id", taskId);
        }
        return task;
    }
    static async deletePendingTask(taskId) {
        const { error } = await supabaseClient_1.supabase.from("pending_tasks").delete().eq("id", taskId);
        if (error)
            throw error;
    }
}
exports.TaskProcessor = TaskProcessor;
// Tiempo de expiración para tareas pendientes (1 hora)
TaskProcessor.TASK_EXPIRATION = 60 * 60 * 1000;
TaskProcessor.SYSTEM_PROMPT = `
    You are a task analyzer. You receive transcribed audio messages in Spanish and extract task information.
    Be practical and use common sense when analyzing tasks.

    Analyze if the audio contains a valid task. A valid task should have:
    - A clear action or objective (if you can understand what needs to be done, it's clear enough)

    Use common sense for duration based on task complexity:
    - very_short: Simple tasks that take less than an hour
    - short: Tasks that typically take a few hours
    - medium: Tasks that might take several days
    - long: Complex tasks that take weeks

    Use common sense for priority:
    - high: Urgent or time-sensitive tasks
    - medium: Regular, routine tasks
    - low: Optional or non-urgent tasks

    IMPORTANT FOR DATES:
    - Pay special attention to date mentions like "el sábado", "mañana", "la próxima semana", etc.
    - Current date is: ${new Date().toISOString()}
    - Convert relative dates to ISO format:
      * "mañana" -> next day at 10:00
      * "el sábado" -> next Saturday at 10:00
      * "la próxima semana" -> next Monday at 10:00
    - If no specific time is mentioned, use 10:00 as default time
    - If no date is mentioned, set dueDate to null

    If the input is NOT a valid task (unclear objective or just testing), respond with:
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
        "duration": "very_short|short|medium|long",
        "priority": "high|medium|low",
        "assignedTo": "string?",
        "dueDate": "ISO date string or null"
      },
      "summary": "Un resumen en español de cómo se interpretó la tarea, SIEMPRE mencionar si hay fecha o no"
    }
`;
TaskProcessor.MERGE_PROMPT = `
    You are a task merger. You receive the original task and additional information in Spanish.
    Combine them intelligently into a single coherent task.

    You MUST respond with a JSON object in this exact format:
    {
      "task": {
        "title": "string",
        "description": "string",
        "duration": "very_short|short|medium|long",
        "priority": "high|medium|low",
        "dueDate": "ISO date string or null"
      },
      "summary": "string describing what was updated in Spanish, ALWAYS mention if there's a due date or not"
    }

    IMPORTANT:
    - Preserve existing dueDate if not explicitly changed in the new information
    - If new date is mentioned, update it
    - ALWAYS include in the summary if there's a due date or not
    - Example summaries:
      "Se actualizó la descripción. La tarea está programada para mañana a las 10:00"
      "Se actualizó la descripción. La tarea no tiene fecha establecida"
      "Se actualizó la descripción y se cambió la fecha de la tarea para el viernes"
`;
