export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  deadline: string; // ISO format: YYYY-MM-DDTHH:mm
  estimatedEffort: number; // in minutes
  urgency: number; // 1 to 5
  status: 'pending' | 'completed' | 'missed' | 'at_risk';
  tags: string[]; // e.g. ["send email", "send message", "urgent", "personal"]
  draftMessage?: string; // drafted text for email/message
  approved?: boolean; // user has approved the draft
  scheduledStart?: string | null; // ISO datetime
  scheduledEnd?: string | null; // ISO datetime
  priorityScore?: number; // calculated score
  riskReason?: string; // explanation if missed or at risk
  createdAt: string; // ISO datetime
  missedCount?: number; // increments every time the task status is set to missed or at_risk
  escalationDraft?: string; // drafted escalation message for accountability contact
  escalationApproved?: boolean; // whether user approved the escalation message draft
}

export interface AgentReasoning {
  id: string;
  userId: string;
  reasoning: string;
  updatedAt: string;
}

export interface UserPreferences {
  workingHoursStart: string; // "HH:MM", default "09:00"
  workingHoursEnd: string; // "HH:MM", default "17:00"
  accountabilityName?: string;
  accountabilityEmail?: string;
}
