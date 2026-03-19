// Interface Agent - Conversational gatekeeper for DevTeam
import { callAI, emitLog } from "./index";

export type Intent = 
  | "CHAT"              // Just conversation
  | "CLARIFY"           // Needs more info before building
  | "BUILD"             // Ready to start pipeline
  | "MODIFY"            // Change existing project
  | "DEBUG"             // Fix errors in current project
  | "EXPLAIN"           // Explain what was built
  | "SUMMARIZE"         // Summary of current state
  | "MARKETING"         // Create marketing materials
  | "SOCIAL_MEDIA"      // Create social media content
  | "STOP"              // Stop current operation
  | "HELP"              // User needs help

export interface InterfaceResponse {
  intent: Intent;
  text: string;
  refinedRequirements?: string;
  taskId?: string;
  confidence: number;
  needsConfirmation: boolean;
  projectSummary?: {
    name: string;
    stack: string;
    estimatedFiles: number;
    estimatedTime: string;
  };
}

const INTERFACE_SYSTEM_PROMPT = `You are the Interface Agent for comp03, an AI-powered software development system.

Your role is to:
1. Understand what the user wants (chat, build, modify, debug, etc.)
2. Ask clarifying questions when needed
3. Summarize requirements before building
4. Route requests to the appropriate agent system
5. Answer questions about completed projects

**Intent Types:**
- CHAT: Casual conversation, greetings, questions about the system
- CLARIFY: Need more information before proceeding
- BUILD: User wants to create a new project (trigger pipeline)
- MODIFY: User wants to change an existing project
- DEBUG: User wants to fix errors in current project
- EXPLAIN: User wants explanation of what was built
- SUMMARIZE: User wants summary of current state
- MARKETING: Create marketing materials (after project complete)
- SOCIAL_MEDIA: Create social media content (after project complete)
- STOP: User wants to stop current operation
- HELP: User needs help or documentation

**Post-Build Conversations:**
When a project has been built, you can:
- Explain what files were created
- Describe the architecture and design decisions
- Suggest how to run the project
- Answer questions about the code
- Recommend improvements

**Rules:**
1. Be friendly and conversational
2. For BUILD intents, always summarize requirements and ask for confirmation
3. For CLARIFY intents, ask specific questions
4. Keep responses concise but helpful
5. Detect tech stack preferences from conversation
6. Estimate project size (small: <10 files, medium: 10-30, large: 30+)
7. If a project was just built, offer to create marketing or social media content

**CRITICAL: Output ONLY valid JSON. No explanations, no reasoning, no text before or after the JSON.**

**Output Format:**
{
  "intent": "BUILD",
  "text": "I understand you want to build a login app with React and JWT. This will create approximately 15-20 files. Ready to start?",
  "refinedRequirements": "Login application with React frontend, Node.js backend, JWT authentication",
  "confidence": 0.95,
  "needsConfirmation": true,
  "projectSummary": {
    "name": "Login App",
    "stack": "React, Node.js, JWT",
    "estimatedFiles": 18,
    "estimatedTime": "3-4 minutes"
  }
}`;

export async function processInterfaceMessage(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  currentTask?: any,
  projectContext?: {
    projectName: string;
    taskDescription: string;
    filesCreated: string[];
    architecture?: string;
  },
  specContext?: {
    projectName: string;
    description: string;
    language: string;
    projectType: string;
    projectStyle: string;
    features: string[];
    framework: string;
  }
): Promise<InterfaceResponse> {
  emitLog("interface", "info", `Processing message: ${message.substring(0, 50)}...`);

  const contextInfo = currentTask 
    ? `\n\nCurrent Project: ${currentTask.project_name || "Unknown"}\nStatus: ${currentTask.status || "unknown"}`
    : "";

  const projectContextInfo = projectContext
    ? `\n\n**Recently Built Project:**
- Name: ${projectContext.projectName}
- Description: ${projectContext.taskDescription}
- Files Created: ${projectContext.filesCreated.join(", ")}
${projectContext.architecture ? `- Architecture: ${projectContext.architecture.substring(0, 500)}...` : ""}`
    : "";

  const specContextInfo = specContext
    ? `\n\n**Project Specification Being Discussed:**
- Name: ${specContext.projectName}
- Description: ${specContext.description}
- Language: ${specContext.language}
- Type: ${specContext.projectType}
- Style: ${specContext.projectStyle}
- Framework: ${specContext.framework}
- Features: ${specContext.features.join(", ")}`
    : "";

  const historyContext = conversationHistory.length > 0
    ? `\n\nRecent Conversation:\n${conversationHistory.slice(-5).map(c => `${c.role}: ${c.content}`).join("\n")}`
    : "";

  const userPrompt = `User message: "${message}"${contextInfo}${projectContextInfo}${specContextInfo}${historyContext}

Analyze the user's intent and respond appropriately. Remember to:
1. Classify the intent correctly
2. Be conversational and helpful
3. For BUILD requests, summarize and ask for confirmation
4. Extract tech stack preferences if mentioned
5. If asking about the recently built project, provide helpful information
6. Offer to create marketing/social media content after a successful build
7. If user is discussing a project specification, help them refine it with best practices

Respond in JSON format only.`;

  try {
    const { content } = await callAI(userPrompt, INTERFACE_SYSTEM_PROMPT);
    
    // Parse JSON response - try multiple patterns
    let response: InterfaceResponse;
    try {
      // Try to find JSON object in the response
      let jsonStr = "";
      
      // Pattern 1: JSON object between braces
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      // Pattern 2: Look for JSON after markdown code block
      if (!jsonStr) {
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        }
      }
      
      // Pattern 3: Look for JSON after "json" keyword
      if (!jsonStr) {
        const afterJsonMatch = content.match(/json[:\s]*([\s\S]*$)/i);
        if (afterJsonMatch) {
          jsonStr = afterJsonMatch[1].trim();
        }
      }
      
      if (jsonStr) {
        response = JSON.parse(jsonStr);
      } else {
        // Fallback if no JSON found
        response = parseFallbackResponse(message, content);
      }
    } catch (parseError) {
      emitLog("interface", "warn", `JSON parse failed, using fallback: ${parseError}`);
      response = parseFallbackResponse(message, content);
    }

    // Validate and clean response
    if (!response.intent) {
      response.intent = "CHAT";
    }
    
    // If text contains JSON, extract the actual message
    if (response.text && response.text.includes('"intent"')) {
      try {
        // Try to extract nested JSON from text
        const nestedMatch = response.text.match(/\{[\s\S]*"intent"[\s\S]*\}/);
        if (nestedMatch) {
          const nested = JSON.parse(nestedMatch[0]);
          if (nested.text && !nested.text.includes('"intent"')) {
            response.text = nested.text;
          }
        }
      } catch (e) {
        // Keep original text if parsing fails
      }
    }
    
    if (!response.text) {
      response.text = content;
    }

    if (response.confidence === undefined) {
      response.confidence = 0.8;
    }

    if (response.needsConfirmation === undefined) {
      response.needsConfirmation = response.intent === "BUILD";
    }

    emitLog("interface", "info", `Intent classified: ${response.intent} (confidence: ${response.confidence})`);

    return response;
  } catch (error: any) {
    emitLog("interface", "error", `Interface agent failed: ${error.message}`);
    
    // Fallback response
    return {
      intent: "CHAT",
      text: "I encountered an error processing your request. Could you please rephrase?",
      confidence: 0.5,
      needsConfirmation: false
    };
  }
}

function parseFallbackResponse(message: string, content: string): InterfaceResponse {
  const lowerMessage = message.toLowerCase();
  
  // Simple keyword-based intent detection
  if (lowerMessage.includes("build") || lowerMessage.includes("create") || lowerMessage.includes("make")) {
    return {
      intent: "BUILD",
      text: `I'll help you build that. ${content}`,
      refinedRequirements: message,
      confidence: 0.7,
      needsConfirmation: true
    };
  }
  
  if (lowerMessage.includes("fix") || lowerMessage.includes("debug") || lowerMessage.includes("error")) {
    return {
      intent: "DEBUG",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("change") || lowerMessage.includes("modify") || lowerMessage.includes("update")) {
    return {
      intent: "MODIFY",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("explain") || lowerMessage.includes("what did")) {
    return {
      intent: "EXPLAIN",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("summary") || lowerMessage.includes("summarize")) {
    return {
      intent: "SUMMARIZE",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("marketing") || lowerMessage.includes("promote") || lowerMessage.includes("sell")) {
    return {
      intent: "MARKETING",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("social") || lowerMessage.includes("tweet") || lowerMessage.includes("post")) {
    return {
      intent: "SOCIAL_MEDIA",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("stop") || lowerMessage.includes("cancel") || lowerMessage.includes("halt")) {
    return {
      intent: "STOP",
      text: "Stopping current operation...",
      confidence: 0.9,
      needsConfirmation: false
    };
  }
  
  if (lowerMessage.includes("help") || lowerMessage.includes("how to")) {
    return {
      intent: "HELP",
      text: content,
      confidence: 0.7,
      needsConfirmation: false
    };
  }
  
  // Default to CHAT
  return {
    intent: "CHAT",
    text: content,
    confidence: 0.5,
    needsConfirmation: false
  };
}

// Generate project summary from requirements
export function generateProjectSummary(requirements: string): {
  name: string;
  stack: string;
  estimatedFiles: number;
  estimatedTime: string;
} {
  const lower = requirements.toLowerCase();
  
  // Detect stack
  let stack = "Node.js, React";
  if (lower.includes("python")) stack = "Python, FastAPI";
  if (lower.includes("vue")) stack = "Vue.js, Node.js";
  if (lower.includes("angular")) stack = "Angular, Node.js";
  if (lower.includes("next.js") || lower.includes("nextjs")) stack = "Next.js, React";
  
  // Estimate size
  let estimatedFiles = 15;
  if (lower.includes("simple") || lower.includes("basic")) estimatedFiles = 8;
  if (lower.includes("full") || lower.includes("complete")) estimatedFiles = 25;
  if (lower.includes("dashboard") || lower.includes("admin")) estimatedFiles = 30;
  if (lower.includes("saas") || lower.includes("platform")) estimatedFiles = 40;
  
  // Estimate time (rough: 10 seconds per file)
  const timeMinutes = Math.ceil(estimatedFiles * 10 / 60);
  
  return {
    name: extractProjectName(requirements),
    stack,
    estimatedFiles,
    estimatedTime: `${timeMinutes}-${timeMinutes + 2} minutes`
  };
}

function extractProjectName(requirements: string): string {
  // Try to extract project name from requirements
  const match = requirements.match(/(?:create|build|make)\s+(?:a|an)?\s*(\w+(?:\s+\w+)*)/i);
  if (match) {
    return match[1].trim();
  }
  return "New Project";
}
