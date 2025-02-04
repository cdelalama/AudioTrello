"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskProcessor = void 0;
const openai_1 = require("openai");
const config_1 = require("../config");
const supabaseClient_1 = require("./supabaseClient");
class DateAgent {
    convertToUTC(localDate, userOffset) {
        const date = new Date(localDate);
        // Restamos el offset para convertir de hora local a UTC
        const utcDate = new Date(date.getTime() - userOffset * 60000);
        return utcDate.toISOString();
    }
    async analyze(text, userId) {
        let userOffset = 60; // Default UTC+1
        if (userId) {
            const { data: user } = await supabaseClient_1.supabase
                .from("users")
                .select("timezone_offset")
                .eq("id", userId)
                .single();
            if (user) {
                userOffset = user.timezone_offset;
            }
        }
        return this.convertToUTC(text, userOffset);
    }
    isDaylightSavingTime(date) {
        // En España, el DST comienza el último domingo de marzo
        // y termina el último domingo de octubre
        const year = date.getFullYear();
        const dstStart = this.getLastSunday(year, 2); // Marzo es 2 (0-based)
        const dstEnd = this.getLastSunday(year, 9); // Octubre es 9 (0-based)
        return date >= dstStart && date < dstEnd;
    }
    getLastSunday(year, month) {
        const date = new Date(year, month + 1, 0); // Último día del mes
        const lastSunday = new Date(date.setDate(date.getDate() - date.getDay()));
        return lastSunday;
    }
}
class ReminderAgent {
    static async analyze(text) {
        try {
            this.approximationMessage = null;
            const normalizedText = this.normalizeText(text);
            // Obtener el valor exacto mencionado por el usuario
            const exactReminder = await this.findReminderByLLM(normalizedText);
            console.log("🎯 LLM Reminder output:", exactReminder);
            if (!exactReminder)
                return null;
            // Aproximar al valor válido de Trello más cercano
            const approximatedValue = this.approximateToTrelloValue(exactReminder);
            console.log("📏 Approximated to:", approximatedValue);
            console.log("💬 Approximation message:", this.approximationMessage);
            return approximatedValue;
        }
        catch (error) {
            console.error("❌ Error in reminder detection:", error);
            return null;
        }
    }
    static approximateToTrelloValue(exactReminder) {
        if (exactReminder === "at_time")
            return "at_time";
        // Extraer número y unidad
        const match = exactReminder.match(/(\d+)_(\w+)/);
        if (!match)
            return null;
        const [, number, unit] = match;
        const value = parseInt(number);
        // Aproximar según las reglas de Trello
        if (unit === "days" || unit === "day") {
            this.approximationMessage =
                value > 2
                    ? "Se ha ajustado tu recordatorio a 2 días antes, que es el máximo permitido por Trello."
                    : null;
            return value > 2 ? "2_days_before" : value === 2 ? "2_days_before" : "1_day_before";
        }
        if (unit === "hours") {
            if (value > 4) {
                this.approximationMessage =
                    "Se ha ajustado tu recordatorio a 2 horas antes, que es el máximo permitido por Trello.";
                return "2_hours_before";
            }
            if (value > 2) {
                this.approximationMessage = `Se ha ajustado tu recordatorio de ${value} horas a 2 horas antes, debido a restricciones de Trello.`;
                return "2_hours_before";
            }
            if (value === 2)
                return "2_hours_before";
            return "1_hour_before";
        }
        if (unit === "minutes") {
            if (value >= 30) {
                this.approximationMessage =
                    "Se ha ajustado tu recordatorio a 15 minutos antes, que es el máximo permitido por Trello para minutos.";
                return "15_minutes_before";
            }
            if (value > 15)
                return "15_minutes_before";
            if (value > 10)
                return "15_minutes_before";
            if (value > 5)
                return "10_minutes_before";
            return "5_minutes_before";
        }
        return null;
    }
    static normalizeText(text) {
        return text.toLowerCase().replace(/hrs?/g, "horas").replace(/mins?/g, "minutos");
    }
    static async findReminderByLLM(text) {
        const openai = new openai_1.OpenAI({ apiKey: config_1.config.openai.apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: this.prompt },
                { role: "user", content: text },
            ],
            temperature: 0,
        });
        return completion.choices[0]?.message?.content?.trim() || null;
    }
}
ReminderAgent.approximationMessage = null;
ReminderAgent.prompt = `
		You are a Spanish reminder detection specialist. Your ONLY job is to find reminder requests.

		IMPORTANT: Be flexible with time formats. Look for:
		- Numbers (2, dos, 2h, 2hrs, etc)
		- Time units (horas, hrs, h, minutos, min, días, etc)
		- Common variations and typos

		Input examples:
		- "quiero sacar a pasear a cooper el domingo y recuérdamelo dos horas antes"
		- "avísame 2 hrs antes de la tarea"
		- "recuérdame 3h antes"
		- "45 minutos antes por favor"
		- "en 2hrs avisame"
		- "avísame 4 días antes"

		Rules:
		1. Extract the EXACT time mentioned by the user and return it in this format:
		   "<number>_hours" or "<number>_minutes" or "<number>_days"
		   Examples:
		   - "3_hours"
		   - "45_minutes"
		   - "4_days"
		   - "1_hour"
		   - "30_minutes"
		   - "2_days"
		   - "at_time" (for "en el momento")
		   - null (if no reminder found)

		2. Map variations:
		   - "tres horas" -> "3_hours"
		   - "45 minutos" -> "45_minutes"
		   - "media hora" -> "30_minutes"
		   - "cuatro días" -> "4_days"

		RESPOND ONLY with the exact time value or null. NO other text.
	`;
class TaskDetailsAgent {
    getOpenAIClient() {
        if (!config_1.config.openai.apiKey) {
            throw new Error("OpenAI API key is not configured");
        }
        return new openai_1.OpenAI({ apiKey: config_1.config.openai.apiKey });
    }
    async analyze(text) {
        try {
            const openai = this.getOpenAIClient();
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: TaskDetailsAgent.TASK_DETAILS_PROMPT },
                    { role: "user", content: text },
                ],
            });
            if (!completion.choices?.[0]?.message?.content) {
                return {
                    isValidTask: false,
                    message: "No se pudo entender el mensaje. Por favor, inténtalo de nuevo.",
                };
            }
            const result = JSON.parse(completion.choices[0].message.content);
            return {
                ...result,
                isValidTask: Boolean(result.task?.title || result.task?.priority || result.task?.description),
            };
        }
        catch (error) {
            console.error("Error in TaskDetailsAgent:", error);
            if (error?.status === 429 || error?.error?.code === "insufficient_quota") {
                return {
                    isValidTask: false,
                    message: "Lo siento, en este momento hay un problema técnico con el servicio de procesamiento de texto (cuota de OpenAI excedida). Por favor, contacta con el administrador o inténtalo más tarde.",
                };
            }
            return {
                isValidTask: false,
                message: "No se pudo entender el mensaje. ¿Podrías reformularlo?",
            };
        }
    }
}
TaskDetailsAgent.TASK_DETAILS_PROMPT = `
	You are a task details specialist. You receive transcribed audio messages in Spanish and extract task information.

	IMPORTANT FOR DESCRIPTIONS:
	- Generate clear and useful descriptions
	- Include relevant details and context
	- Add common sense details that would help complete the task

	IMPORTANT FOR PRIORITIES:
	- Detect priority changes in Spanish like:
	  * "quiero que la prioridad sea alta/baja/media"
	  * "cambiar prioridad a alta/baja/media"
	  * "prioridad alta/baja/media"
	- Always return priority in lowercase: "high", "medium", "low"
	- Map Spanish to English:
	  * alta -> high
	  * media -> medium
	  * baja -> low

	You MUST respond with a valid JSON object in this EXACT format:
	{
	  "isValidTask": true,
	  "task": {
		"title": "string",
		"description": "string",
		"duration": "very_short|short|medium|long",
		"priority": "high|medium|low"
	  },
	  "summary": "string"
	}

	DO NOT include any additional text or explanations outside the JSON object.
	The response MUST be a valid parseable JSON.
	`;
class TaskProcessor {
    // Método para almacenar una tarea y obtener su ID
    static async storePendingTask(taskData, userId) {
        console.log("💾 Storing pending task. User data:", {
            providedUserId: userId,
            taskAssignedTo: taskData.assignedTo,
        });
        // Obtener el ID de la base de datos del usuario usando el telegram_id
        const { data: userData, error: userError } = await supabaseClient_1.supabase
            .from("users")
            .select("id")
            .eq("telegram_id", userId)
            .single();
        if (userError) {
            console.error("Error getting user ID:", userError);
            throw userError;
        }
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 30);
        const { data, error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .insert({
            task_data: taskData,
            user_id: userData.id, // Usamos el ID de la base de datos
            expires_at: expirationDate.toISOString(),
        })
            .select("id")
            .single();
        if (error) {
            console.error("Error storing pending task:", error);
            throw error;
        }
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
    static updateDescriptionWithReminder(description, approximationMessage) {
        // Primero eliminamos cualquier mensaje de aproximación anterior
        const cleanDescription = description.replace(/\n\n⚠️ Se ha ajustado tu recordatorio.*$/s, "");
        // Añadimos el nuevo mensaje si existe
        if (approximationMessage) {
            return `${cleanDescription}\n\n⚠️ ${approximationMessage}`;
        }
        return cleanDescription;
    }
    static async processTranscription(transcription, userId) {
        try {
            // Ejecutar ambas llamadas en paralelo
            const [taskResult, reminder] = await Promise.all([
                this.agents.details.analyze(transcription),
                ReminderAgent.analyze(transcription),
            ]);
            if (!taskResult.isValidTask || !taskResult.task) {
                return {
                    isValidTask: false,
                    message: taskResult.message || "No se pudo procesar la tarea correctamente",
                };
            }
            const taskData = {
                title: taskResult.task.title,
                description: taskResult.task.description,
                duration: taskResult.task.duration,
                priority: taskResult.task.priority,
                dueDate: taskResult.task.dueDate,
                reminder: reminder,
                assignedTo: userId,
            };
            // Actualizar descripción con el mensaje de aproximación
            taskData.description = this.updateDescriptionWithReminder(taskData.description, ReminderAgent.approximationMessage);
            // Convertir la fecha a UTC si existe
            if (taskData.dueDate) {
                taskData.dueDate = await this.agents.date.analyze(taskData.dueDate, parseInt(userId));
            }
            return {
                isValidTask: true,
                taskData,
                summary: taskResult.summary,
            };
        }
        catch (error) {
            console.error("Error processing transcription:", error);
            return {
                isValidTask: false,
                message: "Error al procesar la transcripción",
            };
        }
    }
    static async appendToExistingTask(taskId, transcription, userId) {
        try {
            console.log("📝 Starting appendToExistingTask with params:", { taskId, userId });
            // Obtener la tarea existente
            const existingTask = await this.getPendingTask(taskId, parseInt(userId));
            if (!existingTask) {
                return { error: "Tarea no encontrada" };
            }
            // Obtener el reminder por separado ya que tiene su propia lógica especializada
            const reminder = await ReminderAgent.analyze(transcription);
            // Usar MERGE_PROMPT para combinar la información
            const openai = this.getOpenAIClient();
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4",
                    messages: [
                        { role: "system", content: this.MERGE_PROMPT },
                        {
                            role: "user",
                            content: JSON.stringify({
                                originalTask: existingTask,
                                additionalInfo: transcription,
                            }),
                        },
                    ],
                });
                if (!completion.choices?.[0]?.message?.content) {
                    return { error: "No se pudo procesar la actualización" };
                }
                const mergeResult = JSON.parse(completion.choices[0].message.content);
                // Actualizar la tarea con los resultados combinados
                const updatedTaskData = {
                    ...existingTask,
                    ...mergeResult.task,
                    // Usar el reminder del ReminderAgent si existe, sino mantener el existente
                    reminder: reminder !== null ? reminder : existingTask.reminder,
                };
                // Convertir la fecha a UTC si existe
                if (updatedTaskData.dueDate) {
                    updatedTaskData.dueDate = await this.agents.date.analyze(updatedTaskData.dueDate, parseInt(userId));
                }
                // Actualizar la descripción con el mensaje de aproximación si hay nuevo reminder
                updatedTaskData.description = this.updateDescriptionWithReminder(updatedTaskData.description, reminder ? ReminderAgent.approximationMessage : null);
                // Persistir la tarea actualizada
                await this.updatePendingTask(taskId, updatedTaskData);
                return {
                    taskData: updatedTaskData,
                    summary: mergeResult.summary,
                };
            }
            catch (error) {
                console.error("❌ Error en merge de tarea:", error);
                // Mensaje específico para error de cuota de OpenAI
                if (error?.status === 429 || error?.error?.code === "insufficient_quota") {
                    return {
                        error: "Lo siento, en este momento hay un problema técnico con el servicio de procesamiento de texto (cuota de OpenAI excedida). Por favor, contacta con el administrador o inténtalo más tarde.",
                    };
                }
                return { error: "Error al procesar la actualización" };
            }
        }
        catch (error) {
            console.log("❌ Error en appendToExistingTask:", error);
            return { error: "Error al procesar el mensaje" };
        }
    }
    static async getRecentPendingTask(telegramId) {
        console.log("🔍 Getting recent pending task for telegram_id:", telegramId);
        const { data: userData, error: userError } = await supabaseClient_1.supabase
            .from("users")
            .select("id")
            .eq("telegram_id", telegramId)
            .single();
        if (userError) {
            console.error("Error getting user ID:", userError);
            return null;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .select("*")
            .eq("user_id", userData.id)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (error?.code === "PGRST116") {
            console.log("ℹ️ No pending tasks found for user");
            return null;
        }
        if (error) {
            console.error("Error getting pending task:", error);
            return null;
        }
        return data;
    }
    static async getPendingTask(taskId, telegramId) {
        console.log("🔍 Getting pending task:", { taskId, telegramId });
        const { data, error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .select("task_data")
            .eq("id", taskId)
            .single();
        if (error) {
            console.error("Error getting pending task:", error);
            return null;
        }
        return data?.task_data;
    }
    static async deletePendingTask(taskId) {
        const { error } = await supabaseClient_1.supabase.from("pending_tasks").delete().eq("id", taskId);
        if (error)
            throw error;
    }
    static async updatePendingTask(taskId, taskData) {
        const { error } = await supabaseClient_1.supabase
            .from("pending_tasks")
            .update({ task_data: taskData })
            .eq("id", taskId);
        if (error)
            throw error;
    }
}
exports.TaskProcessor = TaskProcessor;
_a = TaskProcessor;
TaskProcessor.currentDate = new Date();
TaskProcessor.currentHour = _a.currentDate.getHours();
TaskProcessor.currentMinutes = _a.currentDate.getMinutes();
// Tiempo de expiración para tareas pendientes (1 hora)
TaskProcessor.TASK_EXPIRATION = 60 * 60 * 1000;
TaskProcessor.agents = {
    date: new DateAgent(),
    reminder: new ReminderAgent(),
    details: new TaskDetailsAgent(),
};
TaskProcessor.SYSTEM_PROMPT = `
    You are a task merger. You receive the original task and additional information in Spanish.

    IMPORTANT FOR DATES:
    - Current date and time: ${_a.currentDate.toISOString()}
    - ALWAYS use the date mentioned in the message for the task
    - ALWAYS return dates in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
    - Examples:
      * "el martes" -> next Tuesday at current time
      * "mañana" -> tomorrow at current time
      * "el viernes" -> next Friday at current time
    - If no date is mentioned, set dueDate to null
    - NEVER modify the date based on reminders (if user says "avísame 2 horas antes", that's for the reminder, not the date)

    IMPORTANT FOR DESCRIPTIONS:
    - Generate clear and useful descriptions
    - Include relevant details and context
    - Add common sense details that would help complete the task

    IMPORTANT FOR PRIORITIES:
    - Detect priority changes in Spanish like:
      * "quiero que la prioridad sea alta/baja/media"
      * "cambiar prioridad a alta/baja/media"
      * "prioridad alta/baja/media"
    - Always return priority in lowercase: "high", "medium", "low"
    - Map Spanish to English:
      * alta -> high
      * media -> medium
      * baja -> low

    You MUST respond with a valid JSON object in this EXACT format:
    {
      "isValidTask": true,
      "task": {
        "title": "string",
        "description": "string",
        "duration": "very_short|short|medium|long",
        "priority": "high|medium|low",
        "dueDate": "2025-02-04T19:21:35.330Z" // Example date format
      },
      "summary": "string"
    }

    DO NOT include any additional text or explanations outside the JSON object.
    The response MUST be a valid parseable JSON.
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
        "dueDate": "ISO date string or null",
        "reminder": "one_day|one_hour|none|null"
      },
      "summary": "string describing what was updated in Spanish, ALWAYS mention if there's a due date and reminder"
    }

    IMPORTANT FOR DATES:
    - Current date and time: ${_a.currentDate.toISOString()}
    - ALWAYS preserve the time component in dates
    - When updating dates, keep the current time if no new time is specified
    - Format: Full ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)

    IMPORTANT FOR REMINDERS:
    - Detect Spanish reminder phrases in the additional information
    - Common phrases:
      * "recuérdamelo dos horas antes" -> "2_hours_before"
      * "avísame una hora antes" -> "1_hour_before"
      * "recuérdame 5 minutos antes" -> "5_minutes_before"
      * "avisa dos días antes" -> "2_days_before"
    - If a new reminder is mentioned, it should override the existing one
    - If no new reminder is mentioned, keep the existing one

    IMPORTANT FOR DESCRIPTIONS:
    - NEVER return null or empty descriptions
    - If updating description, merge existing details with new ones
    - If no new description details, keep existing one but ensure it's complete

    Example summaries:
      "Se actualizó la descripción. La tarea está programada para mañana a las 10:00"
      "Se actualizó la descripción. La tarea no tiene fecha establecida"
      "Se actualizó la descripción y se cambió la fecha de la tarea para el viernes"
`;
