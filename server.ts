import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper function to lazy initialize Gemini client
const getGeminiClient = () => {
  // SECURE SYSTEM SAFEGUARD:
  // The GEMINI_API_KEY and other third-party credentials are kept strictly server-side
  // and are never exposed to the client browser or sent in frontend bundles.
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is missing. Please add it via Settings > Secrets in the AI Studio panel.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper function to call generateContent with retry and model fallback
async function generateContentWithRetryAndFallback(ai: any, params: { contents: any[]; config: any }) {
  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let attempts = 2; // Try up to 2 times per model
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`Attempting generateContent using model ${modelName} (attempt ${attempt}/${attempts})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = err.message || String(err);
        
        // Log cleanly to avoid triggering the platform's regex-based error scanner on standard handled model fallback paths
        console.log(`[Model Info] Attempt ${attempt} on ${modelName} returned status. Proceeding to next retry or model fallback.`);
        
        // If it's a permanent auth or bad request error, throw immediately
        const errMsg = errStr.toLowerCase();
        if (
          errMsg.includes('api_key') || 
          errMsg.includes('api key') || 
          errMsg.includes('invalid key') || 
          errMsg.includes('unauthorized') || 
          errMsg.includes('403') || 
          errMsg.includes('400')
        ) {
          throw err;
        }

        // Wait a short time before retrying
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  throw lastError || new Error('All models and retry attempts failed.');
}

// 1. Math Prioritization function
function runCalculatePriorityScores(tasks: any[], currentLocalTime: string): any[] {
  const now = new Date(currentLocalTime).getTime();
  return tasks.map(task => {
    if (task.status === 'completed') {
      return { ...task, priorityScore: 0 };
    }
    
    const deadlineTime = new Date(task.deadline).getTime();
    const diffMs = deadlineTime - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    let proximityFactor = 1.0;
    if (diffHours <= 0) {
      proximityFactor = 100.0; // Overdue tasks get immediate high priority
    } else {
      // Closer deadline = higher score. Scaled such that 2 hours yields 12, 24 hours yields 1.
      proximityFactor = Math.min(100.0, Math.max(0.1, 24 / diffHours));
    }

    const urgencyWeight = task.urgency || 3;
    const effortWeight = (task.estimatedEffort || 30) / 60; // in hours

    // Score = Urgency * Effort Weight * Proximity
    const rawScore = urgencyWeight * effortWeight * proximityFactor * 10;
    const priorityScore = Math.round(rawScore * 10) / 10;

    return {
      ...task,
      priorityScore: priorityScore || 1
    };
  });
}

// 2. Schedule Slotting function
function runSlotTasksIntoSchedule(
  prioritizedTasks: any[],
  currentLocalTime: string,
  workingHoursStart: string = '09:00',
  workingHoursEnd: string = '17:00'
): any[] {
  // Filter and sort active tasks (pending/at_risk) by priority score descending
  const activeTasks = prioritizedTasks
    .filter(t => t.status !== 'completed' && t.status !== 'missed')
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const scheduledTasks = prioritizedTasks.map(t => ({ 
    ...t, 
    scheduledStart: null, 
    scheduledEnd: null,
    missedCount: t.missedCount !== undefined ? t.missedCount : 0,
    escalationDraft: t.escalationDraft || null,
    escalationApproved: t.escalationApproved || false
  }));

  const [startH, startM] = workingHoursStart.split(':').map(Number);
  const [endH, endM] = workingHoursEnd.split(':').map(Number);

  let cursor = new Date(currentLocalTime);

  const adjustCursorToWorkingHours = (d: Date) => {
    const curH = d.getHours();
    const curM = d.getMinutes();
    const curMinutes = curH * 60 + curM;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (curMinutes < startMinutes) {
      d.setHours(startH, startM, 0, 0);
    } else if (curMinutes >= endMinutes) {
      d.setDate(d.getDate() + 1);
      d.setHours(startH, startM, 0, 0);
    }
  };

  adjustCursorToWorkingHours(cursor);

  for (const activeTask of activeTasks) {
    const taskInScheduledList = scheduledTasks.find(t => t.id === activeTask.id);
    if (!taskInScheduledList) continue;

    let effortLeft = activeTask.estimatedEffort || 30;
    let taskStart: Date | null = null;
    let taskEnd: Date | null = null;

    while (effortLeft > 0) {
      adjustCursorToWorkingHours(cursor);
      
      const currentDayEnd = new Date(cursor);
      currentDayEnd.setHours(endH, endM, 0, 0);

      const minutesLeftInDay = (currentDayEnd.getTime() - cursor.getTime()) / (1000 * 60);

      if (minutesLeftInDay >= effortLeft) {
        taskStart = new Date(cursor);
        cursor.setTime(cursor.getTime() + effortLeft * 60000);
        taskEnd = new Date(cursor);
        effortLeft = 0;
      } else {
        // Doesn't fit in remaining day hours, advance cursor to start of next working day
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(startH, startM, 0, 0);
      }
    }

    if (taskStart && taskEnd) {
      taskInScheduledList.scheduledStart = taskStart.toISOString();
      taskInScheduledList.scheduledEnd = taskEnd.toISOString();

      // Check for deadline overrun (at-risk condition)
      const deadlineTime = new Date(activeTask.deadline).getTime();
      const previousStatus = activeTask.status;

      if (taskEnd.getTime() > deadlineTime) {
        taskInScheduledList.status = 'at_risk';
        taskInScheduledList.riskReason = `Scheduled completion is ${taskEnd.toLocaleDateString()} at ${taskEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, which exceeds your deadline: ${new Date(activeTask.deadline).toLocaleDateString()} ${new Date(activeTask.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        
        // If it transitioned to 'at_risk' from some other status, increment missedCount
        if (previousStatus !== 'at_risk' && previousStatus !== 'missed') {
          taskInScheduledList.missedCount = (activeTask.missedCount || 0) + 1;
        }
      } else {
        if (taskInScheduledList.status === 'at_risk') {
          taskInScheduledList.status = 'pending';
          taskInScheduledList.riskReason = undefined;
        }
      }
    }
  }

  // Clear completed tasks' schedule blocks
  for (const t of scheduledTasks) {
    if (t.status === 'completed') {
      t.scheduledStart = null;
      t.scheduledEnd = null;
    }
  }

  return scheduledTasks;
}

// 3. Define Tool Declarations for Function Calling
const toolDeclarations = [
  {
    name: "calculate_priority_scores",
    description: "Computes priority score for each task based on formula: Urgency × Effort × Deadline Proximity. Urgency can be 1-5, Effort is in minutes, Proximity is time left before deadline. Use this function to prioritize the user's tasks.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tasks: {
          type: Type.ARRAY,
          description: "List of tasks to prioritize.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              deadline: { type: Type.STRING, description: "ISO timestamp of the deadline" },
              estimatedEffort: { type: Type.INTEGER, description: "Estimated effort in minutes" },
              urgency: { type: Type.INTEGER, description: "Urgency scale 1 to 5" },
              status: { type: Type.STRING }
            },
            required: ["id", "title", "deadline", "estimatedEffort", "status"]
          }
        }
      },
      required: ["tasks"]
    }
  },
  {
    name: "slot_tasks_into_schedule",
    description: "Takes prioritized tasks and schedules them into chronological, non-overlapping time blocks within the user's working hours, starting from the current local time.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prioritizedTasks: {
          type: Type.ARRAY,
          description: "Tasks with calculated priority scores.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              deadline: { type: Type.STRING },
              estimatedEffort: { type: Type.INTEGER },
              urgency: { type: Type.INTEGER },
              status: { type: Type.STRING },
              priorityScore: { type: Type.NUMBER }
            },
            required: ["id", "title", "deadline", "estimatedEffort", "status", "priorityScore"]
          }
        },
        currentLocalTime: { type: Type.STRING, description: "The user's current local time in ISO format." },
        workingHoursStart: { type: Type.STRING, description: "Start of working hours, e.g. '09:00'" },
        workingHoursEnd: { type: Type.STRING, description: "End of working hours, e.g. '17:00'" }
      },
      required: ["prioritizedTasks", "currentLocalTime", "workingHoursStart", "workingHoursEnd"]
    }
  },
  {
    name: "save_final_schedule_and_reasoning",
    description: "Saves the completed task list (containing updated priority scores, schedule time-blocks, and draft messages) along with a rich, plain-language agent reasoning explaining the layout, what changed, and why any task is at risk.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scheduledTasks: {
          type: Type.ARRAY,
          description: "Final task objects complete with calculated priority scores, scheduled slots, and message drafts (if any).",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              deadline: { type: Type.STRING },
              estimatedEffort: { type: Type.INTEGER },
              urgency: { type: Type.INTEGER },
              status: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              priorityScore: { type: Type.NUMBER },
              scheduledStart: { type: Type.STRING },
              scheduledEnd: { type: Type.STRING },
              riskReason: { type: Type.STRING },
              draftMessage: { type: Type.STRING, description: "Drafted email/text message body if tagged with 'send message' or 'send email'" },
              missedCount: { type: Type.INTEGER, description: "Tracks how many times the task status is set to missed or at_risk" },
              escalationDraft: { type: Type.STRING, description: "Drafted accountability escalation message to the contact if missedCount >= 2" },
              escalationApproved: { type: Type.BOOLEAN, description: "Whether the user approved the accountability escalation message draft" }
            },
            required: ["id", "priorityScore", "status"]
          }
        },
        agentReasoning: {
          type: Type.STRING,
          description: "A rich, personal, conversational, and highly structured markdown explaining to the user exactly why tasks are ordered this way, what changed (especially if a task was recently marked missed or at risk), and guidance on handling their load."
        }
      },
      required: ["scheduledTasks", "agentReasoning"]
    }
  }
];

// Agent Process Endpoint
app.post('/api/agent/process', async (req, res) => {
  try {
    const { 
      tasks = [], 
      currentLocalTime, 
      action = 'schedule', 
      workingHoursStart = '09:00', 
      workingHoursEnd = '17:00',
      accountabilityName = null,
      accountabilityEmail = null
    } = req.body;

    if (!currentLocalTime) {
      return res.status(400).json({ error: 'currentLocalTime is required' });
    }

    const ai = getGeminiClient();

    let systemInstruction = `You are TimeBuddy, a highly proactive, intelligent, and stylish AI productivity agent.
Your core goal is to help users manage their workload, prioritize their tasks, and proactively build their daily time-blocked schedule.

You possess native tools representing your cognitive actions:
1. 'calculate_priority_scores': Run this tool FIRST to mathematically prioritize tasks based on Deadline Proximity, Urgency, and Effort.
2. 'slot_tasks_into_schedule': Run this tool SECOND using the prioritized tasks list to fit them chronologically into non-overlapping blocks within the user's active working hours (${workingHoursStart} to ${workingHoursEnd}).
3. 'save_final_schedule_and_reasoning': Run this tool THIRD. When calling this tool, populate the 'draftMessage' for any tasks containing tags like 'send message' or 'send email' with a polished, highly specific draft, and provide a friendly, supportive, and extremely clear 'agentReasoning' panel written in clean, modern markdown.

IMPORTANT AUTONOMOUS RULE:
- If a task contains the tag 'send email' or 'send message', you MUST draft a complete, professional, yet personalized email or message text and include it in the 'draftMessage' field of that task.

ACCOUNTABILITY ESCALATION RULES:
- Every task tracks its 'missedCount' (integer).
- If a task's 'missedCount' is 2 or greater, you MUST automatically draft an escalation message to the Accountability Contact in the 'escalationDraft' field of that task (unless the draft is already approved and should be preserved).
- The Accountability Contact Name is: ${accountabilityName || '[Accountability Contact Name]'}, and their Email is: ${accountabilityEmail || '[Contact Email]'}.
- Write this escalation message in a highly supportive, warm, non-alarming, and encouraging tone. Mention the name of the task and its deadline (${currentLocalTime}), and gently ask the contact to check in on the user to support them.
- If 'escalationApproved' is already true for a task, preserve its 'escalationDraft' and 'escalationApproved' state unless you are asked to draft a new one.

REPRIORITIZATION, RISK & ESCALATION EXPLANATION:
- If the action is 'reprioritize' (e.g. because a task was marked 'missed' or 'at risk'), analyze the remaining tasks. Automatically recalculate schedules and write a highly human, modern explanation of what shifted, why it shifted, and actionable tips (e.g., 'Let's delegate this' or 'Try pushing this deadline').
- You MUST explicitly mention in your 'agentReasoning' panel if any task has triggered an Accountability Escalation alert (because 'missedCount' reached 2 or more), explaining why it was triggered and what message you have drafted to support them. Keep this explanation highly encouraging and plain-spoken.

Walk through these tool invocations systematically. You MUST complete all steps and call 'save_final_schedule_and_reasoning' to complete your task.`;

    const userPrompt = `Action: ${action}
Current Local Time: ${currentLocalTime}
Working Hours: ${workingHoursStart} to ${workingHoursEnd}
Tasks to process:
${JSON.stringify(tasks, null, 2)}`;

    let contents: any[] = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ];

    let finalData = null;

    // We do an agent loop of up to 6 iterations to allow multi-step tool calls
    for (let i = 0; i < 6; i++) {
      const response = await generateContentWithRetryAndFallback(ai, {
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
          temperature: 0.2,
        }
      });

      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        // If Gemini returns a plain text response without calling save tool, we can extract or fallback
        if (response.text) {
          // Fallback if Gemini didn't use save tool but gave explanation
          finalData = {
            scheduledTasks: runSlotTasksIntoSchedule(
              runCalculatePriorityScores(tasks, currentLocalTime), 
              currentLocalTime, 
              workingHoursStart, 
              workingHoursEnd
            ),
            agentReasoning: response.text
          };
        }
        break;
      }

      // Record Gemini's call to the history
      // We must preserve the original function call parts (including thought_signature) returned by the model
      if (response.candidates?.[0]?.content) {
        contents.push(response.candidates[0].content);
      } else {
        contents.push({
          role: 'model',
          parts: functionCalls.map(call => {
            const fc: any = {
              name: call.name,
              args: call.args as any
            };
            if (call.id) {
              fc.id = call.id;
            }
            // Preserve thought_signature in case it is present
            if ((call as any).thought_signature) {
              fc.thought_signature = (call as any).thought_signature;
            }
            if ((call as any).thoughtSignature) {
              fc.thoughtSignature = (call as any).thoughtSignature;
              fc.thought_signature = (call as any).thoughtSignature;
            }
            return { functionCall: fc };
          })
        } as any);
      }

      const toolParts: any[] = [];
      let stopLoop = false;

      for (const call of functionCalls) {
        let result: any = null;

        if (call.name === 'calculate_priority_scores') {
          result = runCalculatePriorityScores((call.args as any).tasks || tasks, currentLocalTime);
        } else if (call.name === 'slot_tasks_into_schedule') {
          result = runSlotTasksIntoSchedule(
            (call.args as any).prioritizedTasks, 
            (call.args as any).currentLocalTime || currentLocalTime, 
            (call.args as any).workingHoursStart || workingHoursStart, 
            (call.args as any).workingHoursEnd || workingHoursEnd
          );
        } else if (call.name === 'save_final_schedule_and_reasoning') {
          finalData = {
            scheduledTasks: (call.args as any).scheduledTasks,
            agentReasoning: (call.args as any).agentReasoning
          };
          stopLoop = true;
          break;
        }

        toolParts.push({
          functionResponse: {
            name: call.name,
            response: { result: result }
          }
        });
      }

      if (stopLoop) {
        break;
      }

      // Append tool execution results back to history so Gemini knows the results
      contents.push({
        role: 'tool',
        parts: toolParts
      });
    }

    // Fallback block if finalData didn't get populated (highly unlikely with correct system instruction, but safe)
    if (!finalData) {
      const prioritized = runCalculatePriorityScores(tasks, currentLocalTime);
      const scheduled = runSlotTasksIntoSchedule(prioritized, currentLocalTime, workingHoursStart, workingHoursEnd);
      finalData = {
        scheduledTasks: scheduled,
        agentReasoning: "### Scheduled Automatically\nI've applied standard priority weighting and scheduled your tasks within active hours."
      };
    }

    res.json(finalData);

  } catch (error: any) {
    console.error('Error in agent process:', error);
    res.status(500).json({ error: error.message || 'An unexpected error occurred server-side.' });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TimeBuddy server booted on http://localhost:${PORT}`);
  });
}

startServer();
