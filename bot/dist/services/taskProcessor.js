"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskProcessor = void 0;
const openai_1 = require("openai");
const config_1 = require("../config");
const supabaseClient_1 = require("./supabaseClient");
class DateAgent {
    async analyze(text) {
        const prompt = `
			You are a date extraction specialist.
			Current time: ${new Date().toISOString()}
			Find and convert dates to ISO format.
			Example: "el martes" -> "2024-02-04T19:09:00.000Z"
			Return ONLY the ISO date or null.
		`;
        // ... implementación
    }
}
class ReminderAgent {
    static async analyze(text) {
        try {
            // 1. Preprocesar el texto
            const normalizedText = this.normalizeText(text);
            // 2. Intentar primero con regex para casos comunes
            const regexReminder = this.findReminderByRegex(normalizedText);
            if (regexReminder) {
                console.log("📢 Reminder found by regex:", regexReminder);
                return regexReminder;
            }
            // 3. Si no hay match por regex, usar LLM
            console.log("🤖 Using LLM for reminder detection...");
            const llmReminder = await this.findReminderByLLM(normalizedText);
            // 4. Validar el resultado
            if (!this.isValidReminder(llmReminder)) {
                console.log("⚠️ Invalid reminder detected:", llmReminder);
                return null;
            }
            return llmReminder;
        }
        catch (error) {
            console.error("❌ Error in reminder detection:", error);
            return null; // Fail gracefully
        }
    }
    static normalizeText(text) {
        return text.toLowerCase().replace(/hrs?/g, "horas").replace(/mins?/g, "minutos");
    }
    static findReminderByRegex(text) {
        const patterns = [
            { regex: /2\s*(?:h|hr|hrs|horas)/, value: "2_hours_before" },
            { regex: /1\s*(?:h|hr|hrs|hora)/, value: "1_hour_before" },
            // ... más patrones
        ];
        for (const pattern of patterns) {
            if (pattern.regex.test(text))
                return pattern.value;
        }
        return null;
    }
    static isValidReminder(reminder) {
        const validReminders = [
            "2_hours_before",
            "1_hour_before",
            "15_minutes_before",
            "10_minutes_before",
            "5_minutes_before",
            "1_day_before",
            "2_days_before",
            "at_time",
            null,
        ];
        return validReminders.includes(reminder);
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
ReminderAgent.prompt = `
		You are a Spanish reminder detection specialist. Your ONLY job is to find reminder requests.

		IMPORTANT: Be flexible with time formats. Look for:
		- Numbers (2, dos, 2h, 2hrs, etc)
		- Time units (horas, hrs, h, minutos, min, días, etc)
		- Common variations and typos

		Input examples:
		- "quiero sacar a pasear a cooper el domingo y recuérdamelo dos horas antes"
		- "avísame 2 hrs antes de la tarea"
		- "recuérdame 2h antes"
		- "2 horas antes por favor"
		- "en 2hrs avisame"

		Rules:
		1. ONLY return one of these exact values:
		   - "2_hours_before" (for 2-4 hours)
		   - "1_hour_before" (for 1 hour)
		   - "15_minutes_before" (for 15-30 minutes)
		   - "10_minutes_before" (for 5-15 minutes)
		   - "5_minutes_before" (for < 5 minutes)
		   - "1_day_before" (for 1 day)
		   - "2_days_before" (for 2+ days)
		   - "at_time" (for "en el momento")
		   - null (if no reminder found)

		2. Map variations:
		   - "2 hrs/2h/2 horas/dos horas" -> "2_hours_before"
		   - "1 hr/1h/una hora" -> "1_hour_before"
		   - "30 min/media hora" -> "15_minutes_before"
		   - "15 min/quince minutos" -> "15_minutes_before"
		   - "10 min/diez minutos" -> "10_minutes_before"
		   - "5 min/cinco minutos" -> "5_minutes_before"
		   - "1 día/un día" -> "1_day_before"
		   - "2 días/dos días" -> "2_days_before"

		RESPOND ONLY with the reminder value or null. NO other text.
	`;
class TaskDetailsAgent {
    async analyze(text) {
        const prompt = `
			You are a task details specialist.
			Extract: title, description, duration, priority
			Return JSON with these fields only.
		`;
        // ... implementación
    }
}
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
            console.log("\n📝 Processing transcription:", transcription);
            const taskResult = await this.processMainTask(transcription);
            console.log("✅ Main task result:", taskResult);
            if (!taskResult.isValidTask || !taskResult.task) {
                return {
                    isValidTask: false,
                    message: taskResult.message || "No se pudo procesar la tarea correctamente",
                };
            }
            console.log("🕒 Analyzing reminder...");
            const reminder = await ReminderAgent.analyze(transcription);
            console.log("✨ Final reminder value:", reminder);
            const taskData = {
                title: taskResult.task.title,
                description: taskResult.task.description,
                duration: taskResult.task.duration,
                priority: taskResult.task.priority,
                dueDate: taskResult.task.dueDate,
                reminder: reminder,
                assignedTo: userId,
            };
            return {
                isValidTask: true,
                taskData,
                summary: taskResult.summary,
            };
        }
        catch (error) {
            console.error("❌ Error in processTranscription:", error);
            return {
                isValidTask: false,
                message: "Hubo un error procesando la tarea. Por favor, inténtalo de nuevo.",
            };
        }
    }
    static generateSummary(taskData) {
        // Implementa la lógica para generar un resumen a partir de los datos de la tarea
        return `Resumen de la tarea: ${taskData.title} - ${taskData.description}`;
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
        const mergePrompt = `
			You are a task merger. You receive the original task and additional information in Spanish.
			Combine them intelligently into a single coherent task.

			IMPORTANT FOR DATES:
			- Current date is: ${this.currentDate.toISOString()}
			- Current time is: ${this.currentHour}:${this.currentMinutes}
			- When updating dates:
			  * If no specific time is mentioned, use current time
			  * For future dates without time, use same current time

			IMPORTANT FOR DESCRIPTIONS:
			- NEVER return null or empty descriptions
			- If updating description, merge existing details with new ones
			- If no new description details, keep existing one but ensure it's complete

			IMPORTANT FOR REMINDERS:
			- Use natural Spanish phrases for reminders
			- Examples: "Una hora antes", "30 minutos antes", "2 días antes"
			- If updating reminder, convert to natural format
			- If no new reminder mentioned, keep existing one
			- Do NOT use technical formats like "one_hour"

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
    static async processMainTask(transcription) {
        const openai = this.getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: this.SYSTEM_PROMPT },
                { role: "user", content: transcription },
            ],
        });
        if (!completion.choices?.[0]?.message?.content) {
            return {
                isValidTask: false,
                message: "No se pudo procesar la tarea. Por favor, inténtalo de nuevo.",
            };
        }
        return JSON.parse(completion.choices[0].message.content);
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
    You are a task analyzer. You receive transcribed audio messages in Spanish and extract task information.

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
TaskProcessor.reminderPrompt = `
    You are a reminder analyzer. Analyze the Spanish text and extract ONLY reminder information.
    Return ONE of these specific values or null:
    * "at_time" -> "en el momento"
    * "5_minutes_before" -> "5 minutos antes"
    * "10_minutes_before" -> "10 minutos antes"
    * "15_minutes_before" -> "15 minutos antes"
    * "1_hour_before" -> "una hora antes"
    * "2_hours_before" -> "dos horas antes"
    * "1_day_before" -> "un día antes"
    * "2_days_before" -> "dos días antes"

    Common Spanish phrases to detect:
    * "recuérdamelo/avísame/recuérdame/avisa X antes"
    * "X horas/minutos/días antes"
    Where X can be any number or word (uno/una, dos, tres, cuatro...)

    Map to closest available option:
    * 3-4 horas -> "2_hours_before"
    * 1-2 horas -> "1_hour_before"
    * 20-30 minutos -> "15_minutes_before"
    * 1-2 días -> "1_day_before"

    Examples:
    "quiero hacer algo el martes y avísame cuatro horas antes" -> "2_hours_before"
    "recuérdamelo tres horas antes" -> "2_hours_before"
    "avísame media hora antes" -> "15_minutes_before"

    Respond with ONLY the reminder value or null if no reminder is found.
`;
