# TimeBuddy: Proactive AI Productivity Agent

TimeBuddy is a time-management agent built on **Gemini function calling**. Give it tasks with deadlines, effort estimates and urgency. It scores and prioritises them, time-blocks them into your working hours, drafts any emails or messages a task needs, and replans when something slips.

## How the agent works

`POST /api/agent/process` runs a multi-step **tool-calling loop** (up to 6 iterations) on Gemini:

```
tasks + working hours + current time
        │
        ▼
1. calculate_priority_scores        deadline proximity × urgency × effort
        │
        ▼
2. slot_tasks_into_schedule         non-overlapping time blocks within working hours
        │
        ▼
3. save_final_schedule_and_reasoning
        ├─ schedule (start / end per task)
        ├─ draftMessage for tasks tagged "send email" / "send message"
        ├─ escalationDraft when a task has been missed ≥ 2 times
        └─ agentReasoning: a markdown explanation of what moved and why
```

- **Reprioritisation:** marking a task *missed* or *at risk* triggers a replan, with a plain-language explanation of what shifted.
- **Accountability escalation:** after two misses, the agent drafts a supportive check-in message to a contact you chose. Nothing is sent without your approval.
- **Resilience:** retries with model fallback across several Gemini models.

## Features

- Google sign-in with **Firebase Auth**; tasks, preferences and agent reasoning stored in **Firestore**, with per-user security rules
- Schedule view, task cards with risk reasons, and an "agent reasoning" panel
- Approve or edit drafted messages and escalations before use
- Configurable working hours and accountability contact

## Tech

React 19 · TypeScript · Vite · Tailwind CSS · Motion · Express (API server) · Google Gen AI SDK (Gemini) · Firebase Auth + Firestore

## Run locally

```bash
npm install
cp .env.example .env.local      # set GEMINI_API_KEY
npm run dev                     # Express + Vite dev server
```

Production build: `npm run build && npm start`.

Firebase project settings are in `firebase-applet-config.json`, and access rules are in [`firestore.rules`](firestore.rules).

---

Originally prototyped in Google AI Studio.
