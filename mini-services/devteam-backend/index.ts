// Bun-based backend server for devteam
// This provides the same API as the Python FastAPI backend

import { serve } from "bun";
import path from "path";
import yaml from "yaml";
import { nanoid } from "nanoid";
import fs from "fs";
import { MemorySystem } from "./memory";
import { webSearch, formatSearchResultsForAI, searchTechDocs, searchCodeExamples } from "./search";
import { processInterfaceMessage, InterfaceResponse, generateProjectSummary } from "./interface-agent";
import { executeProject, writeExecutionLog } from "./executor-agent";
import { analyzeExecutionError, writeDebugLog, getDebugHistory, updateDebugHistory } from "./debugger-agent";
import { analyzePersistentError, writeResourceReport, contactPlanner } from "./resource-agent";
import { generateMarketingMaterials, writeMarketingReport } from "./marketing-agent";
import { generateSocialMediaContent, writeSocialMediaReport } from "./social-media-agent";
import { generateTests, writeTestFiles, runTests, writeTestResults } from "./tester-agent";
import { analyzeCodeQuality, writeQAReport, checkCodeMetrics } from "./qa-agent";
import { decomposeProject, getNextTask, allTasksComplete, getDecompositionProgress } from "./decomposer-agent";

// Load config
const configPath = path.join(import.meta.dir, "config.yaml");
const configFile = Bun.file(configPath);
const configText = await configFile.text();
const cfg = yaml.parse(configText);

// Initialize memory system
const workspaceRoot = path.join(import.meta.dir, cfg.workspace.root);
const memory = new MemorySystem(workspaceRoot);

// Types
interface Task {
  task_id: string;
  project_id: string;
  project_name: string;
  summary: string;
  assumptions: string[];
  stack_hint: string;
  complexity: string;
  tasks: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface AgentStatus {
  agent: string;
  status: "waiting" | "running" | "done" | "failed";
}

interface LogMessage {
  type: "log";
  agent: string;
  level: "info" | "warn" | "error";
  message: string;
  ts: string;
}

interface AgentStatusMessage {
  type: "agent_status";
  agent: string;
  status: "running" | "done" | "failed";
  task_id: string;
}

interface FsChangeMessage {
  type: "fs_change";
  path: string;
  action: "created" | "modified" | "deleted";
}

interface TaskCompleteMessage {
  type: "task_complete";
  task_id: string;
  verdict: "pass" | "fail";
  project_name?: string;
  files_created?: string[];
  project_summary?: ProjectSummary;
}

interface ProjectSummary {
  name: string;
  description: string;
  howToUse: string;
  filesCreated: string[];
  techStack: string;
  runInstructions: string;
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type WsMessage = LogMessage | AgentStatusMessage | FsChangeMessage | TaskCompleteMessage | ErrorMessage;

// WebSocket clients
const wsClients: Set<WebSocket> = new Set();

// Current task state
let currentTaskId: string | null = null;
let currentTask: Task | null = null;
const agentStates: Record<string, string> = {
  orchestrator: "waiting",
  interface: "waiting",
  decomposer: "waiting",
  planner: "waiting",
  researcher: "waiting",
  architect: "waiting",
  coder: "waiting",
  reviewer: "waiting",
  tester: "waiting",
  qa: "waiting",
  executor: "waiting",
  debugger: "waiting",
  resource: "waiting",
  marketing: "waiting",
  social: "waiting",
};

// Log buffer
const logBuffer: LogMessage[] = [];

// Helper functions
function getTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function broadcast(message: WsMessage) {
  const data = JSON.stringify(message);
  wsClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

export function emitLog(agent: string, level: "info" | "warn" | "error", message: string) {
  const log: LogMessage = { type: "log", agent, level, message, ts: getTimestamp() };
  logBuffer.push(log);
  if (logBuffer.length > 1000) logBuffer.shift();
  broadcast(log);
}

function emitStatus(agent: string, status: "running" | "done" | "failed", taskId: string) {
  agentStates[agent] = status;
  broadcast({ type: "agent_status", agent, status, task_id: taskId });
}

function emitFsChange(filePath: string, action: "created" | "modified" | "deleted") {
  broadcast({ type: "fs_change", path: filePath, action });
}

function emitTaskComplete(taskId: string, verdict: "pass" | "fail", projectName?: string, filesCreated?: string[], projectSummary?: ProjectSummary) {
  broadcast({ type: "task_complete", task_id: taskId, verdict, project_name: projectName, files_created: filesCreated, project_summary: projectSummary });
}

// Workspace helpers (workspaceRoot already declared above)

function getProjectPath(taskId: string): string {
  return path.join(workspaceRoot, "projects", taskId);
}

function ensureProjectDir(taskId: string): string {
  const projectPath = getProjectPath(taskId);
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }
  return projectPath;
}

function readYamlFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.parse(match[1]);
  } catch {
    return {};
  }
}

function writeMarkdownWithFrontmatter(frontmatter: Record<string, any>, body: string): string {
  return `---\n${yaml.stringify(frontmatter).trim()}\n---\n\n${body}`;
}

function getFileTree(dir: string, baseDir: string = dir): any[] {
  const items: any[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      let relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        items.push({
          name: entry.name,
          type: "directory",
          path: relativePath.replace(/\\/g, "/"),
          children: getFileTree(fullPath, baseDir),
        });
      } else {
        items.push({
          name: entry.name,
          type: "file",
          path: relativePath.replace(/\\/g, "/"),
        });
      }
    }
  } catch (e) {
    // Directory doesn't exist
  }
  return items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "directory" ? -1 : 1;
  });
}

// AI Client for calling LM Studio / OpenAI-compatible APIs
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

let currentModel: string = "";

async function getLoadedModel(): Promise<string> {
  try {
    const response = await fetch(`${cfg.ai.base_url}/models`, {
      headers: {
        "Authorization": `Bearer ${cfg.ai.api_key}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.status}`);
    }
    
    const data = await response.json();
    const models: LMStudioModel[] = data.data || [];
    
    if (models.length === 0) {
      throw new Error("No models available in LM Studio");
    }
    
    // Use the first available model (or you can add logic to pick a specific one)
    const selectedModel = models[0].id;
    emitLog("system", "info", `Using model: ${selectedModel}`);
    return selectedModel;
  } catch (error: any) {
    emitLog("system", "error", `Failed to get model from LM Studio: ${error.message}`);
    throw error;
  }
}

export async function callAI(prompt: string, systemPrompt: string): Promise<{ content: string; tokens: number }> {
  // Get the currently loaded model (auto-detect from LM Studio)
  if (!currentModel || cfg.ai.model === "auto") {
    currentModel = await getLoadedModel();
  }
  
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ];

  try {
    const response = await fetch(`${cfg.ai.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.ai.api_key}`
      },
      body: JSON.stringify({
        model: currentModel,
        messages,
        max_tokens: cfg.ai.max_tokens,
        temperature: cfg.ai.temperature
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const content = data.choices[0]?.message?.content || "";
    const tokens = data.usage?.total_tokens || 0;

    return { content, tokens };
  } catch (error: any) {
    emitLog("system", "error", `AI call failed: ${error.message}`);
    throw error;
  }
}

// Agent execution with rich context
async function runAgent(
  agent: string,
  taskId: string,
  context: Record<string, any>
): Promise<string> {
  emitStatus(agent, "running", taskId);
  emitLog(agent, "info", `Starting ${agent} agent...`);

  // Build rich context from previous agents
  const projectPath = getProjectPath(taskId);
  const previousOutputs: Record<string, string> = {};
  
  // Load previous agent outputs
  const agentOrder = ["planner", "researcher", "architect", "coder", "reviewer", "documentor"];
  const currentIndex = agentOrder.indexOf(agent);
  
  for (let i = 0; i < currentIndex; i++) {
    const prevAgent = agentOrder[i];
    const prevFile = path.join(projectPath, `${prevAgent}.md`);
    if (fs.existsSync(prevFile)) {
      try {
        previousOutputs[prevAgent] = await Bun.file(prevFile).text();
      } catch {}
    }
  }

  // Get memory context
  const taskDescription = context.task?.summary || context.task?.project_name || "";
  const memoryContext = memory.generateContextPrompt(agent, taskDescription);

  // Enrich context with previous outputs and memory
  const enrichedContext = {
    ...context,
    previousOutputs,
    memoryContext,
    allPreviousAgents: Object.keys(previousOutputs),
  };

  let output = "";
  let failed = false;

  try {
    switch (agent) {
      case "planner":
        output = await generatePlannerOutput(taskId, enrichedContext);
        break;
      case "researcher":
        output = await generateResearcherOutput(taskId, enrichedContext);
        break;
      case "architect":
        output = await generateArchitectOutput(taskId, enrichedContext);
        break;
      case "coder":
        output = await generateCoderOutput(taskId, enrichedContext);
        break;
      case "reviewer":
        output = await generateReviewerOutput(taskId, enrichedContext);
        break;
      case "documentor":
        output = await generateDocumentorOutput(taskId, enrichedContext);
        break;
      default:
        output = "Unknown agent";
    }
  } catch (error: any) {
    emitLog(agent, "error", `Agent failed: ${error.message}`);
    output = generateErrorOutput(taskId, enrichedContext, agent, error.message);
    failed = true;
  }

  emitStatus(agent, failed ? "failed" : "done", taskId);
  emitLog(agent, failed ? "error" : "info", `${agent} ${failed ? "failed" : "completed"}`);

  return output;
}

const PLANNER_SYSTEM_PROMPT = `You are the Planner Agent in a software development team. Your role is to create detailed implementation plans for software projects.

When given a task description, create a comprehensive implementation plan that includes:
1. Overview of what will be built
2. Phased approach with specific steps
3. Acceptance criteria for each phase
4. Dependencies needed
5. Risk assessment

Output your plan in Markdown format with clear sections. Use proper formatting with headers, lists, and bold text for emphasis.

IMPORTANT: Output ONLY the plan content, no additional explanations or commentary.`;

async function generatePlannerOutput(taskId: string, context: Record<string, any>): Promise<string> {
  const task = context.task || currentTask;
  const taskDescription = task?.summary || task?.project_name || "Unknown task";
  const stackHint = task?.stack_hint || "";
  const memoryContext = context.memoryContext || "";

  const userPrompt = `Create an implementation plan for this project:

Project: ${taskDescription}
${stackHint ? `Tech Stack: ${stackHint}` : ""}
${memoryContext ? `\n\n${memoryContext}` : ""}

Include:
- Overview
- Phase-by-phase breakdown with specific steps
- Acceptance criteria for each phase
- Dependencies
- Risk assessment`;

  emitLog("planner", "info", "Calling AI for planning...");
  const { content, tokens } = await callAI(userPrompt, PLANNER_SYSTEM_PROMPT);

  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent: "planner",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: tokens,
  };

  return writeMarkdownWithFrontmatter(frontmatter, content);
}

const RESEARCHER_SYSTEM_PROMPT = `You are the Researcher Agent in a software development team. Your role is to research technologies, frameworks, best practices, and any relevant information needed to implement a project.

When given a task and implementation plan, research:
1. Best technologies to use
2. Recommended libraries and frameworks
3. Best practices for the chosen stack
4. Potential issues or pitfalls to avoid
5. Documentation and resources

Output your research in Markdown format with clear sections. Be practical and focus on technologies that are well-maintained and stable.

IMPORTANT: Output ONLY the research content, no additional explanations or commentary.`;

async function generateResearcherOutput(taskId: string, context: Record<string, any>): Promise<string> {
  const task = context.task || currentTask;
  const taskDescription = task?.summary || task?.project_name || "Unknown task";
  const stackHint = task?.stack_hint || "";
  const memoryContext = context.memoryContext || "";
  const plannerOutput = context.previousOutputs?.planner || "";

  // Perform web search for additional research
  emitLog("researcher", "info", "Searching web for latest information...");
  let searchResults = "";
  
  try {
    // Search for relevant technologies and best practices
    const searchQuery = stackHint || taskDescription;
    const results = await webSearch(`${searchQuery} best practices tutorial 2024`, 5);
    searchResults = formatSearchResultsForAI(results);
    
    // Search for code examples if stack is mentioned
    if (stackHint) {
      const techResults = await searchCodeExamples(stackHint, "getting started");
      if (techResults.length > 0) {
        searchResults += "\n\n## Code Examples & Tutorials\n" + formatSearchResultsForAI(techResults);
      }
    }
  } catch (error: any) {
    emitLog("researcher", "warn", `Web search failed: ${error.message}`);
    searchResults = "Web search unavailable. Using knowledge base only.";
  }

  const userPrompt = `Research the best approach for building this project:

Project: ${taskDescription}
${stackHint ? `Tech Stack: ${stackHint}` : ""}
${plannerOutput ? `\n\n## Implementation Plan (from Planner Agent):\n${plannerOutput.substring(0, 3000)}...` : ""}
${memoryContext ? `\n\n${memoryContext}` : ""}
${searchResults ? `\n\n${searchResults}` : ""}

Based on the project requirements, implementation plan, and web research, identify:
- Best technologies and frameworks
- Recommended libraries
- Best practices to follow
- Potential issues and how to avoid them
- Useful documentation and resources`;

  emitLog("researcher", "info", "Calling AI for research...");
  const { content, tokens } = await callAI(userPrompt, RESEARCHER_SYSTEM_PROMPT);

  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent: "researcher",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: tokens,
  };

  return writeMarkdownWithFrontmatter(frontmatter, content);
}

const ARCHITECT_SYSTEM_PROMPT = `You are the Architect Agent in a software development team. Your role is to design the system architecture, file structure, data models, API endpoints, and component hierarchy.

When given a task, implementation plan, and research, create a comprehensive architecture document that includes:
1. Recommended file structure
2. Data models and interfaces (in TypeScript)
3. API endpoints with methods and paths
4. Component hierarchy
5. Security considerations

Output in Markdown format with code examples where appropriate. Be specific and practical.

IMPORTANT: Output ONLY the architecture content, no additional explanations or commentary.`;

async function generateArchitectOutput(taskId: string, context: Record<string, any>): Promise<string> {
  const task = context.task || currentTask;
  const taskDescription = task?.summary || task?.project_name || "Unknown task";
  const stackHint = task?.stack_hint || "";
  const memoryContext = context.memoryContext || "";
  const plannerOutput = context.previousOutputs?.planner || "";
  const researcherOutput = context.previousOutputs?.researcher || "";

  const userPrompt = `Design the architecture for this project:

Project: ${taskDescription}
${stackHint ? `Tech Stack: ${stackHint}` : ""}
${plannerOutput ? `\n\n## Implementation Plan (from Planner):\n${plannerOutput.substring(0, 2000)}...` : ""}
${researcherOutput ? `\n\n## Research Findings (from Researcher):\n${researcherOutput.substring(0, 2000)}...` : ""}
${memoryContext ? `\n\n${memoryContext}` : ""}

Include:
- File and directory structure
- Data models (TypeScript interfaces)
- API endpoints (methods, paths, descriptions)
- Component hierarchy
- Security considerations
- Any relevant code examples`;

  emitLog("architect", "info", "Calling AI for architecture design...");
  const { content, tokens } = await callAI(userPrompt, ARCHITECT_SYSTEM_PROMPT);

  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent: "architect",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: tokens,
  };

  return writeMarkdownWithFrontmatter(frontmatter, content);
}

const CODER_SYSTEM_PROMPT = `You are the Coder Agent in a software development team. Your role is to write actual code files based on the architecture design and requirements.

When given a task and architecture:
1. Analyze the requirements and architecture
2. Write all necessary code files
3. Use proper syntax (HTML, CSS, JavaScript, TypeScript as appropriate)
4. Follow best practices
5. Include comments where helpful

CRITICAL OUTPUT FORMAT - You MUST use this exact format for each file:
Write each file like this:

Filename: src/index.html
\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>Hello World</title>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
\`\`\`

Filename: src/styles.css
\`\`\`css
body {
    font-family: sans-serif;
}
\`\`\`

OR use this format:
\`\`\`filepath: src/index.html
<!DOCTYPE html>
<html>
...
\`\`\`

IMPORTANT: 
- Start each file with "Filename: path/to/file" or "filepath: path/to/file"
- Follow with the code in a code block
- Output ALL files needed for the project
- Do NOT write any explanation text, ONLY the file contents
- Use appropriate file extensions based on the project type`;

async function generateCoderOutput(taskId: string, context: Record<string, any>): Promise<string> {
  const task = context.task || currentTask;
  const taskDescription = task?.summary || task?.project_name || "Unknown task";
  const stackHint = task?.stack_hint || "";
  const memoryContext = context.memoryContext || "";
  const architectOutput = context.previousOutputs?.architect || "";
  const plannerOutput = context.previousOutputs?.planner || "";

  const userPrompt = `Write the complete code for this project:

Project: ${taskDescription}
${stackHint ? `Tech Stack: ${stackHint}` : ""}
${architectOutput ? `\n\n## Architecture Design (from Architect):\n${architectOutput.substring(0, 3000)}...` : ""}
${plannerOutput ? `\n\n## Implementation Plan Summary:\n${plannerOutput.substring(0, 1000)}...` : ""}
${memoryContext ? `\n\n${memoryContext}` : ""}

Create ALL the files needed. For a web project, include:
- index.html (main HTML file)
- styles.css (CSS styles)
- script.js (JavaScript if needed)

For a Node.js/Express project, include:
- src/main.ts or src/index.js (entry point)
- src/routes.ts or src/routes.js (routes)
- src/controllers/ (controllers)
- package.json (dependencies)

Generate complete, working code. Output each file using the required format.`;

  emitLog("coder", "info", "Calling AI for code generation...");
  const { content: aiContent, tokens } = await callAI(userPrompt, CODER_SYSTEM_PROMPT);

  // Parse files from AI output - try multiple formats
  let fileBlocks: string[] = [];
  
  // Try "Filename: path" format
  fileBlocks = aiContent.match(/Filename: ([^\n]+)\n```[\w]*\n([\s\S]*?)```/g) || [];
  
  // Try "filepath: path" format
  if (fileBlocks.length === 0) {
    fileBlocks = aiContent.match(/```filepath: ([^\n]+)\n([\s\S]*?)```/g) || [];
  }
  
  // Try just code blocks with path in first line
  if (fileBlocks.length === 0) {
    fileBlocks = aiContent.match(/```(\w*)\n([\s\S]*?)```/g) || [];
  }
  
  const projectPath = getProjectPath(taskId);
  const filesCreated: string[] = [];

  // Parse "Filename: path" format
  for (const block of aiContent.matchAll(/Filename: ([^\n]+)\n```(\w*)\n([\s\S]*?)```/g)) {
    const filePath = block[1].trim();
    const fileContent = block[3].trim();
    
    const fullPath = path.join(projectPath, filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    emitLog("coder", "info", `Writing ${filePath}...`);
    await Bun.write(fullPath, fileContent);
    emitFsChange(filePath, "created");
    filesCreated.push(filePath);
  }

  // Parse "filepath: path" format
  for (const block of aiContent.matchAll(/```filepath: ([^\n]+)\n([\s\S]*?)```/g)) {
    const filePath = block[1].trim();
    const fileContent = block[2].trim();
    
    const fullPath = path.join(projectPath, filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    emitLog("coder", "info", `Writing ${filePath}...`);
    await Bun.write(fullPath, fileContent);
    emitFsChange(filePath, "created");
    if (!filesCreated.includes(filePath)) {
      filesCreated.push(filePath);
    }
  }

  if (filesCreated.length === 0) {
    emitLog("coder", "warn", "No files parsed from AI output, creating basic structure");
    
    // Fallback: create a basic index.html
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${taskDescription}</title>
</head>
<body>
    <h1>${taskDescription}</h1>
    <p>Generated by DevTeam AI</p>
    <script>
        console.log("${taskDescription} - Application started");
    </script>
</body>
</html>`;
    
    await Bun.write(path.join(projectPath, "index.html"), htmlContent);
    emitFsChange("index.html", "created");
    filesCreated.push("index.html");
  }

  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent: "coder",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: tokens,
  };

  const body = `# Coder Output

## Files Created
${filesCreated.map(f => `- \`${f}\``).join("\n")}

## Summary
Generated ${filesCreated.length} file(s) based on the architecture design.
`;

  return writeMarkdownWithFrontmatter(frontmatter, body);
}

const REVIEWER_SYSTEM_PROMPT = `You are the Reviewer Agent in a software development team. Your role is to review generated code for correctness, completeness, and quality.

When given the task description and generated files:
1. Verify all required files exist
2. Check code for syntax errors
3. Verify logic is correct
4. Check for security issues
5. Verify implementation matches requirements

Output a review report in Markdown format that includes:
- Verdict: PASS or FAIL
- Checklist results for each check
- Issues found (if any)
- Suggestions for improvement

Be thorough but practical. Focus on critical issues that would prevent the code from running.

IMPORTANT: Output ONLY the review content, no additional explanations or commentary.`;

async function generateReviewerOutput(taskId: string, context: Record<string, any>): Promise<string> {
  const task = context.task || currentTask;
  const taskDescription = task?.summary || task?.project_name || "Unknown task";
  const memoryContext = context.memoryContext || "";
  
  // Get generated files
  const projectPath = getProjectPath(taskId);
  let filesContent = "";
  
  function getAllFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch {}
    return files;
  }
  
  const allFiles = getAllFiles(projectPath);
  
  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".md") continue; // Skip markdown files
    if (ext === ".json" && path.basename(file) === "package-lock.json") continue;
    
    try {
      const content = await Bun.file(file).text();
      const relativePath = path.relative(projectPath, file);
      filesContent += `\n--- ${relativePath} ---\n${content.substring(0, 2000)}\n`;
    } catch {}
  }

  const userPrompt = `Review the generated code for this project:

Project: ${taskDescription}

Generated Files:
${filesContent}
${memoryContext ? `\n\n${memoryContext}` : ""}

Perform a thorough review covering:
1. File structure completeness
2. Code syntax and correctness
3. Logic and implementation quality
4. Security concerns
5. Whether it meets the requirements

Provide a verdict (PASS/FAIL) and detailed findings.`;

  emitLog("reviewer", "info", "Calling AI for code review...");
  const { content, tokens } = await callAI(userPrompt, REVIEWER_SYSTEM_PROMPT);

  // Determine verdict from content
  const verdict = content.toLowerCase().includes("verdict: fail") || 
                 content.toLowerCase().includes("verdict:fail") ? "fail" : "pass";

  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent: "reviewer",
    status: "complete",
    verdict,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: tokens,
  };

  return writeMarkdownWithFrontmatter(frontmatter, content);
}

const DOCUMENTOR_SYSTEM_PROMPT = `You are the Documentation Agent in a software development team. Your role is to analyze generated code and create proper configuration files and documentation.

Your responsibilities:
1. Detect the programming language and runtime from generated files
2. Create appropriate configuration files (package.json, requirements.txt, go.mod, etc.)
3. Generate a comprehensive README.md with real installation and run commands

CRITICAL: Output ONLY valid file contents. Use this exact format for each file:

Filename: requirements.txt
\`\`\`
flask>=2.0.0
requests>=2.28.0
\`\`\`

Filename: README.md
\`\`\`markdown
# Project Name
...
\`\`\`

Rules:
1. For Python: Create requirements.txt with dependencies extracted from imports
2. For Node.js/TypeScript: Create package.json with scripts and dependencies
3. For Go: Create go.mod with module name and dependencies
4. For Rust: Create Cargo.toml with dependencies
5. README.md must include:
   - Project name and description
   - Prerequisites (Python 3.x, Node.js 18.x, etc.)
   - Installation command (exact, based on config file)
   - Run command (exact, based on entry point like main.py or index.js)
   - Features list

Do NOT write explanations, ONLY file contents.`;

async function generateDocumentorOutput(taskId: string, context: Record<string, any>): Promise<string> {
  const task = context.task || currentTask;
  const taskDescription = task?.summary || task?.project_name || "Unknown task";
  const stackHint = task?.stack_hint || "";
  const projectPath = getProjectPath(taskId);
  
  // Collect all generated files
  const codeFiles = collectCodeFiles(projectPath);
  const fileList = codeFiles.map(f => `- ${f.path}`).join("\n");
  
  // Extract imports from Python files
  const pythonImports: Set<string> = new Set();
  const jsImports: Set<string> = new Set();
  
  for (const file of codeFiles) {
    if (file.path.endsWith('.py')) {
      const importMatches = file.content.matchAll(/^(?:import|from)\s+(\w+)/gm);
      for (const match of importMatches) {
        pythonImports.add(match[1]);
      }
    }
    if (file.path.endsWith('.js') || file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
      const importMatches = file.content.matchAll(/(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"])/g);
      for (const match of importMatches) {
        const pkg = match[1] || match[2];
        if (pkg && !pkg.startsWith('.') && !pkg.startsWith('@/')) {
          jsImports.add(pkg.startsWith('@') ? pkg.split('/')[0] + '/' + pkg.split('/')[1] : pkg);
        }
      }
    }
  }
  
  // Find entry point
  let entryPoint = "";
  for (const file of codeFiles) {
    if (file.path.endsWith('main.py') || file.path.endsWith('app.py') || file.path === 'src/main.py') {
      entryPoint = file.path;
      break;
    }
    if (file.path.endsWith('index.js') || file.path.endsWith('index.ts') || file.path.endsWith('main.ts')) {
      entryPoint = file.path;
    }
  }
  
  // Read planner for features
  let features = "";
  try {
    const plannerContent = await Bun.file(path.join(projectPath, "planner.md")).text();
    const featuresMatch = plannerContent.match(/(?:Key Features|Core Features):?\s*([\s\S]*?)(?=##|---|$)/i);
    if (featuresMatch) {
      features = featuresMatch[1].trim();
    }
  } catch {}
  
  const userPrompt = `Analyze this generated project and create appropriate configuration files and README.md.

Project: ${taskDescription}
Tech Stack: ${stackHint || "Auto-detect from files"}

Files Generated:
${fileList}

${pythonImports.size > 0 ? `Python imports detected: ${[...pythonImports].join(", ")}` : ""}
${jsImports.size > 0 ? `JS/TS imports detected: ${[...jsImports].join(", ")}` : ""}
${entryPoint ? `Entry point: ${entryPoint}` : ""}

${features ? `Features:\n${features}` : ""}

Create:
1. The appropriate config file for this language (requirements.txt for Python, package.json for Node.js, etc.)
2. A README.md with real installation and run commands based on the actual files

Remember: Output ONLY file contents in the format:
Filename: <path>
\`\`\`
<content>
\`\`\``;

  emitLog("documentor", "info", "Calling AI for documentation generation...");
  const { content, tokens } = await callAI(userPrompt, DOCUMENTOR_SYSTEM_PROMPT);
  
  // Parse files from AI output and write them
  const filesCreated: string[] = [];
  
  for (const block of content.matchAll(/Filename: ([^\n]+)\n```[\w]*\n([\s\S]*?)```/g)) {
    const filePath = block[1].trim();
    const fileContent = block[2].trim();
    
    const fullPath = path.join(projectPath, filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await Bun.write(fullPath, fileContent);
    emitFsChange(filePath, "created");
    filesCreated.push(filePath);
    emitLog("documentor", "info", `Created ${filePath}`);
  }
  
  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent: "documentor",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: tokens,
  };

  const body = `# Documentor Output

## Files Created
${filesCreated.map(f => `- \`${f}\``).join("\n") || "None (AI did not generate valid files)"}

## Summary
Generated documentation and configuration files for the project.
`;

  return writeMarkdownWithFrontmatter(frontmatter, body);
}

function generateErrorOutput(taskId: string, context: Record<string, any>, agent: string, error: string): string {
  const task = context.task || currentTask;
  
  const frontmatter = {
    task_id: taskId,
    project_id: task?.project_id || "unknown",
    agent,
    status: "failed",
    error,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: 0,
  };

  const body = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent Error

## Error
${error}

## Status
This agent failed to complete successfully.

## Troubleshooting
- Check if LM Studio is running
- Verify API configuration in config.yaml
- Check network connectivity
- Ensure model is loaded in LM Studio
`;

  return writeMarkdownWithFrontmatter(frontmatter, body);
}

// Pipeline execution
let pipelineRunning = false;

async function runPipeline(taskId: string, task: Task) {
  if (pipelineRunning) {
    emitLog("system", "error", "Pipeline already running");
    return;
  }

  pipelineRunning = true;
  currentTaskId = taskId;
  currentTask = task;

  // Reset agent states
  for (const agent of Object.keys(agentStates)) {
    agentStates[agent] = "waiting";
  }

  // Create project directory
  ensureProjectDir(taskId);

  // Write task.md
  const taskFrontmatter = {
    task_id: taskId,
    project_id: task.project_id,
    project_name: task.project_name,
    agent: "orchestrator",
    status: "in_progress",
    created_at: task.created_at,
    updated_at: new Date().toISOString(),
    model_used: cfg.ai.model,
    tokens_used: 500,
  };

  const taskBody = `# Task: ${task.project_name}

## Summary
${task.summary}

## Assumptions
${task.assumptions.map((a) => `- ${a}`).join("\n")}

## Stack Hint
${task.stack_hint || "Not specified"}

## Complexity
${task.complexity}

## Tasks
${task.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`;

  const projectPath = getProjectPath(taskId);
  await Bun.write(path.join(projectPath, "task.md"), writeMarkdownWithFrontmatter(taskFrontmatter, taskBody));
  emitFsChange("projects/" + taskId + "/task.md", "created");

  try {
    // Phase 0: Decomposition (for complex projects)
    const isComplex = task.complexity === "high" || task.complexity === "very_high" || task.tasks.length > 3;
    let subTasks: any[] = [];
    
    if (isComplex) {
      emitStatus("decomposer", "running", taskId);
      emitLog("system", "info", "Decomposing complex project into sub-tasks...");
      
      const decomposition = await decomposeProject(task.summary, task.stack_hint);
      subTasks = decomposition.subTasks;
      
      emitLog("system", "info", `Decomposed into ${subTasks.length} sub-tasks (${decomposition.complexity} complexity)`);
      
      // Save decomposition
      await Bun.write(
        path.join(projectPath, "decomposition.md"),
        `# Project Decomposition

## Original Request
${task.summary}

## Complexity
${decomposition.complexity}

## Sub-Tasks (${subTasks.length})
${subTasks.map((t, i) => `
### ${i + 1}. ${t.title}
- **Description:** ${t.description}
- **Dependencies:** ${t.dependencies.length > 0 ? t.dependencies.join(", ") : "None"}
- **Estimated Files:** ${t.estimatedFiles}
- **Estimated Time:** ${t.estimatedTime}
`).join("\n")}

## Total Estimates
- Files: ${decomposition.totalEstimatedFiles}
- Time: ${decomposition.totalEstimatedTime}
`
      );
      
      emitStatus("decomposer", "done", taskId);
    }
    
    // Phase 1: Execute sub-tasks or single pipeline
    let verdict = "pass";
    
    if (subTasks.length > 0) {
      // Execute sub-tasks sequentially
      const completedTaskIds: string[] = [];
      
      for (let i = 0; i < subTasks.length; i++) {
        const subTask = subTasks[i];
        emitLog("system", "info", `Executing sub-task ${i + 1}/${subTasks.length}: ${subTask.title}`);
        
        // Update sub-task status
        subTask.status = "in_progress";
        
        // Create sub-task context
        const subTaskContext = {
          ...task,
          summary: `${task.summary} - ${subTask.title}: ${subTask.description}`,
          subTaskId: subTask.id,
          subTaskIndex: i + 1,
          totalSubTasks: subTasks.length
        };
        
        // Run standard pipeline for this sub-task
        const subVerdict = await runStandardPipeline(taskId, subTaskContext, projectPath);
        
        if (subVerdict === "fail") {
          subTask.status = "failed";
          verdict = "fail";
          emitLog("system", "error", `Sub-task ${i + 1} failed`);
          break;
        }
        
        subTask.status = "complete";
        completedTaskIds.push(subTask.id);
        
        // Save progress checkpoint
        await saveCheckpoint(taskId, {
          completedSubTasks: completedTaskIds,
          currentSubTask: i + 1,
          totalSubTasks: subTasks.length,
          verdict
        });
      }
    } else {
      // Single pipeline (no decomposition)
      verdict = await runStandardPipeline(taskId, task, projectPath);
    }

    // Update task status
    const finalFrontmatter = { ...taskFrontmatter, status: "complete", updated_at: new Date().toISOString() };
    await Bun.write(path.join(projectPath, "task.md"), writeMarkdownWithFrontmatter(finalFrontmatter, taskBody));

    // Get list of created files
    const createdFiles = collectCodeFiles(projectPath).map(f => f.path);

    // Store memories from this task
    await storeTaskMemories(taskId, task, projectPath, verdict);

    // Generate project summary for successful builds
    let projectSummary: ProjectSummary | undefined = undefined;
    if (verdict === "pass") {
      emitLog("interface", "info", "Generating project summary...");
      try {
        projectSummary = await generateProjectSummary(taskId, task, projectPath, createdFiles);
      } catch (error: any) {
        emitLog("system", "warn", `Failed to generate project summary: ${error.message}`);
      }
    }

    emitTaskComplete(taskId, verdict as "pass" | "fail", task.project_name, createdFiles, projectSummary);
    emitLog("system", "info", `Pipeline completed with verdict: ${verdict}. Memories stored.`);
  } catch (error: any) {
    emitLog("system", "error", `Pipeline error: ${error.message}`);
    emitTaskComplete(taskId, "fail", currentTask?.project_name);
  }

  pipelineRunning = false;
  currentTaskId = null;
}

// Run standard 5-agent pipeline + executor loop
async function runStandardPipeline(
  taskId: string,
  task: Task,
  projectPath: string
): Promise<string> {
  const agents = ["planner", "researcher", "architect", "coder", "reviewer", "documentor"];
  let verdict = "pass";
  
  // Phase 1: Standard pipeline
  for (const agent of agents) {
    emitStatus(agent, "running", taskId);
    
    const outputPath = path.join(projectPath, `${agent}.md`);
    const context = { task, taskId };

    try {
      const output = await runAgent(agent, taskId, context);
      await Bun.write(outputPath, output);
      emitFsChange(`projects/${taskId}/${agent}.md`, "created");

      // Check for reviewer verdict
      if (agent === "reviewer") {
        const frontmatter = readYamlFrontmatter(output);
        if (frontmatter.verdict === "fail") {
          verdict = "fail";
        }
      }
    } catch (error: any) {
      emitLog(agent, "error", `Agent failed: ${error.message}`);
      // Documentor failure doesn't fail the pipeline, others do
      if (agent !== "documentor") {
        throw error;
      }
    }
    
    emitStatus(agent, "done", taskId);
  }

  // Phase 2: Enhanced Executor Loop (with Test + QA)
  if (verdict !== "fail") {
    emitLog("system", "info", "Starting enhanced executor loop with testing and QA...");
    const executorResult = await runEnhancedExecutorLoop(taskId, task, projectPath);
    
    if (!executorResult.success) {
      verdict = "fail";
      emitLog("system", "warn", `Executor loop completed with issues: ${executorResult.message}`);
    } else {
      emitLog("system", "info", `Executor loop completed successfully after ${executorResult.iterations} iteration(s)`);
    }
  }
  
  return verdict;
}

// Executor Loop - Run code and fix errors iteratively
async function runExecutorLoop(
  taskId: string,
  task: Task,
  projectPath: string
): Promise<{ success: boolean; iterations: number; message: string }> {
  const MAX_ITERATIONS = 10;
  const MAX_SAME_ERROR = 3;
  
  let debugHistory = getDebugHistory(projectPath);
  let iteration = 0;
  let lastErrorHash = "";
  let sameErrorCount = 0;
  
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    debugHistory = getDebugHistory(projectPath);
    debugHistory.iterations = iteration;
    
    emitStatus("executor", "running", taskId);
    emitLog("executor", "info", `Starting execution iteration ${iteration}...`);
    
    // Execute the project
    const execConfig = {
      projectPath,
      installCommand: "npm install",
      buildCommand: "npm run build",
      timeout: 300000 // 5 minutes
    };
    
    const result = await executeProject(execConfig);
    await writeExecutionLog(projectPath, result, iteration);
    
    // Check if successful
    if (result.success) {
      emitStatus("executor", "done", taskId);
      emitLog("executor", "info", "Execution successful!");
      return { success: true, iterations: iteration, message: "Build successful" };
    }
    
    // Analyze the error
    emitStatus("debugger", "running", taskId);
    const analysis = await analyzeExecutionError(result.stderr, result.stdout, projectPath, debugHistory);
    await writeDebugLog(projectPath, analysis, iteration);
    
    // Check for repeated errors
    if (analysis.errorHash === lastErrorHash) {
      sameErrorCount++;
    } else {
      sameErrorCount = 1;
      lastErrorHash = analysis.errorHash;
    }
    
    // Check if we need intervention
    if (sameErrorCount >= MAX_SAME_ERROR || iteration >= MAX_ITERATIONS) {
      emitLog("system", "warn", `Triggering resource agent (iteration: ${iteration}, same error: ${sameErrorCount})`);
      
      emitStatus("resource", "running", taskId);
      const resourceAnalysis = await analyzePersistentError(
        analysis.errorType,
        analysis.description,
        debugHistory,
        task.summary
      );
      
      await writeResourceReport(projectPath, resourceAnalysis, iteration);
      
      // If 10+ iterations, contact planner
      if (iteration >= MAX_ITERATIONS) {
        emitLog("system", "error", "Maximum iterations reached, contacting planner");
        await contactPlanner(projectPath, resourceAnalysis, result.stderr);
        emitStatus("planner", "running", taskId);
        return { 
          success: false, 
          iterations: iteration, 
          message: "Maximum iterations reached, planner intervention required" 
        };
      }
      
      // Resource agent provides fix, coder implements
      emitStatus("coder", "running", taskId);
      emitLog("coder", "info", "Implementing resource agent fix...");
      
      // Update debug history
      updateDebugHistory(projectPath, debugHistory, analysis);
      continue;
    }
    
    // Normal error - coder should fix
    emitStatus("coder", "running", taskId);
    emitLog("coder", "info", `Fixing ${analysis.errorType}...`);
    
    // Run coder in fix mode
    const fixContext = {
      task,
      taskId,
      debugLog: path.join(projectPath, "debug_log.md"),
      fixMode: true,
      errorType: analysis.errorType,
      suggestedFix: analysis.suggestedFix
    };
    
    const fixOutput = await runAgent("coder", taskId, fixContext);
    await Bun.write(path.join(projectPath, "coder_fix.md"), fixOutput);
    
    // Update debug history
    updateDebugHistory(projectPath, debugHistory, analysis);
  }
  
  return { success: false, iterations: iteration, message: "Max iterations reached" };
}

// Enhanced Executor Loop - with Testing and QA
async function runEnhancedExecutorLoop(
  taskId: string,
  task: Task,
  projectPath: string
): Promise<{ success: boolean; iterations: number; message: string }> {
  const MAX_ITERATIONS = 50; // Maximum retry iterations for executor loop
  const MAX_SAME_ERROR = 3;
  const NO_PROGRESS_THRESHOLD = 5; // No test improvement in 5 iterations
  
  let debugHistory = getDebugHistory(projectPath);
  let iteration = 0;
  let lastErrorHash = "";
  let sameErrorCount = 0;
  let lastTestScore = 0;
  let noProgressCount = 0;
  let allCodeFiles: Array<{ path: string; content: string }> = [];
  
  // Collect all generated code files
  allCodeFiles = collectCodeFiles(projectPath);
  
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    debugHistory = getDebugHistory(projectPath);
    debugHistory.iterations = iteration;
    
    emitStatus("executor", "running", taskId);
    emitLog("executor", "info", `Starting execution iteration ${iteration}...`);
    
    // Execute the project
    const execConfig = {
      projectPath,
      installCommand: "npm install",
      buildCommand: "npm run build",
      timeout: 300000 // 5 minutes
    };
    
    const result = await executeProject(execConfig);
    await writeExecutionLog(projectPath, result, iteration);
    
    // Check if build successful
    if (!result.success) {
      // Analyze the error
      emitStatus("debugger", "running", taskId);
      const analysis = await analyzeExecutionError(result.stderr, result.stdout, projectPath, debugHistory);
      await writeDebugLog(projectPath, analysis, iteration);
      
      // Check for repeated errors
      if (analysis.errorHash === lastErrorHash) {
        sameErrorCount++;
      } else {
        sameErrorCount = 1;
        lastErrorHash = analysis.errorHash;
      }
      
      // Check if we need intervention
      if (sameErrorCount >= MAX_SAME_ERROR) {
        emitLog("system", "warn", `Triggering resource agent (same error ${sameErrorCount} times)`);
        
        emitStatus("resource", "running", taskId);
        const resourceAnalysis = await analyzePersistentError(
          analysis.errorType,
          analysis.description,
          debugHistory,
          task.summary
        );
        
        await writeResourceReport(projectPath, resourceAnalysis, iteration);
        
        // Resource agent provides fix, coder implements
        emitStatus("coder", "running", taskId);
        emitLog("coder", "info", "Implementing resource agent fix...");
        
        updateDebugHistory(projectPath, debugHistory, analysis);
        continue;
      }
      
      // Normal error - coder should fix
      emitStatus("coder", "running", taskId);
      emitLog("coder", "info", `Fixing ${analysis.errorType}...`);
      
      const fixContext = {
        task,
        taskId,
        debugLog: path.join(projectPath, "debug_log.md"),
        fixMode: true,
        errorType: analysis.errorType,
        suggestedFix: analysis.suggestedFix
      };
      
      const fixOutput = await runAgent("coder", taskId, fixContext);
      await Bun.write(path.join(projectPath, "coder_fix.md"), fixOutput);
      
      updateDebugHistory(projectPath, debugHistory, analysis);
      continue;
    }
    
    // Build successful - run tests
    emitStatus("tester", "running", taskId);
    emitLog("tester", "info", "Generating and running tests...");
    
    // Collect current code files
    const currentCodeFiles = collectCodeFiles(projectPath);
    
    // Generate tests
    const { testFiles, count } = await generateTests(taskId, projectPath, currentCodeFiles);
    
    if (count > 0) {
      await writeTestFiles(projectPath, testFiles);
      emitLog("tester", "info", `Generated ${count} test files`);
    }
    
    // Run tests
    const testResult = await runTests(projectPath);
    await writeTestResults(projectPath, testResult, iteration);
    
    // Calculate test score (percentage passed)
    const testScore = testResult.totalTests > 0 
      ? (testResult.passedTests / testResult.totalTests) * 100 
      : 100;
    
    // Check for progress
    if (testScore <= lastTestScore) {
      noProgressCount++;
      emitLog("qa", "warn", `No test progress (score: ${testScore}%, last: ${lastTestScore}%, no-progress: ${noProgressCount})`);
    } else {
      noProgressCount = 0;
      lastTestScore = testScore;
    }
    
    // Self-evaluation: No progress in 5 iterations?
    if (noProgressCount >= NO_PROGRESS_THRESHOLD) {
      emitLog("system", "warn", "No test progress in 5 iterations, triggering resource agent");
      
      emitStatus("resource", "running", taskId);
      const resourceAnalysis = await analyzePersistentError(
        "NO_PROGRESS",
        `Test score stuck at ${testScore}% for ${noProgressCount} iterations`,
        debugHistory,
        task.summary
      );
      
      await writeResourceReport(projectPath, resourceAnalysis, iteration);
      noProgressCount = 0; // Reset counter
    }
    
    // Run QA analysis
    emitStatus("qa", "running", taskId);
    emitLog("qa", "info", "Analyzing code quality...");
    
    const qaReport = await analyzeCodeQuality(projectPath, currentCodeFiles);
    await writeQAReport(projectPath, qaReport, iteration);
    
    // Check if tests pass and QA passes
    const testsPass = testResult.success || testScore >= 80; // 80% pass rate acceptable
    const qaPass = qaReport.overall === "pass" || qaReport.overall === "warning";
    
    if (testsPass && qaPass) {
      emitStatus("executor", "done", taskId);
      emitLog("executor", "info", `Execution successful! Tests: ${testScore}%, QA: ${qaReport.overall}`);
      return { success: true, iterations: iteration, message: "Build + Tests + QA passed" };
    }
    
    // Need fixes - determine what to fix
    if (!testsPass) {
      emitLog("system", "info", `Tests failed (${testScore}% pass), analyzing failures...`);
      // Coder should fix test failures
      emitStatus("coder", "running", taskId);
      
      const fixContext = {
        task,
        taskId,
        testResults: testResult.output,
        fixMode: true,
        errorType: "TEST_FAILURE",
        suggestedFix: `Fix failing tests. Test output: ${testResult.output.substring(0, 500)}`
      };
      
      const fixOutput = await runAgent("coder", taskId, fixContext);
      await Bun.write(path.join(projectPath, "test_fix.md"), fixOutput);
    }
    
    if (!qaPass && qaReport.issues.length > 0) {
      emitLog("system", "info", "QA issues found, fixing...");
      // Coder should fix QA issues
      emitStatus("coder", "running", taskId);
      
      const topIssues = qaReport.issues.slice(0, 3).map(i => i.description).join("; ");
      
      const fixContext = {
        task,
        taskId,
        qaReport: JSON.stringify(qaReport),
        fixMode: true,
        errorType: "QA_ISSUES",
        suggestedFix: `Fix code quality issues: ${topIssues}`
      };
      
      const fixOutput = await runAgent("coder", taskId, fixContext);
      await Bun.write(path.join(projectPath, "qa_fix.md"), fixOutput);
    }
    
    // Update code files for next iteration
    allCodeFiles = collectCodeFiles(projectPath);
    
    // Save checkpoint
    await saveCheckpoint(taskId, {
      iteration,
      testScore,
      qaOverall: qaReport.overall,
      noProgressCount
    });
  }
  
  return { success: false, iterations: iteration, message: "Max iterations reached" };
}

// Collect all code files from project
function collectCodeFiles(projectPath: string): Array<{ path: string; content: string }> {
  const codeFiles: Array<{ path: string; content: string }> = [];
  
  function scanDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
          scanDir(fullPath);
        } else {
          const ext = path.extname(fullPath).toLowerCase();
          if ([".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".py", ".go"].includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const relativePath = path.relative(projectPath, fullPath);
              codeFiles.push({ path: relativePath, content });
            } catch {}
          }
        }
      }
    } catch {}
  }
  
  scanDir(projectPath);
  return codeFiles;
}

// Save checkpoint for crash recovery
async function saveCheckpoint(taskId: string, data: any) {
  const checkpointPath = path.join(
    getProjectPath(taskId),
    ".checkpoint.json"
  );
  
  const checkpoint = {
    taskId,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  try {
    await Bun.write(checkpointPath, JSON.stringify(checkpoint, null, 2));
  } catch (error: any) {
    emitLog("system", "warn", `Failed to save checkpoint: ${error.message}`);
  }
}

// Store memories from completed task
async function storeTaskMemories(taskId: string, task: Task, projectPath: string, verdict: string) {
  const projectName = task.project_name;
  
  // Store code snippets from generated files
  function storeFilesInDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          storeFilesInDir(fullPath);
        } else {
          const ext = path.extname(fullPath).toLowerCase();
          if ([".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".scss", ".json"].includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const relativePath = path.relative(projectPath, fullPath);
              memory.storeCodeSnippet(relativePath, content, taskId, projectName);
            } catch {}
          }
        }
      }
    } catch {}
  }
  
  storeFilesInDir(projectPath);
  
  // Store lessons from reviewer output
  const reviewerFile = path.join(projectPath, "reviewer.md");
  if (fs.existsSync(reviewerFile)) {
    try {
      const content = await Bun.file(reviewerFile).text();
      // Extract suggestions section
      const suggestionsMatch = content.match(/## Suggestions\n([\s\S]*?)(?:\n##|\n$)/);
      if (suggestionsMatch) {
        memory.storeLesson(taskId, projectName, "reviewer", suggestionsMatch[1].trim());
      }
      // Extract issues found
      const issuesMatch = content.match(/## Issues Found\n([\s\S]*?)(?:\n##|\n$)/);
      if (issuesMatch && issuesMatch[1].trim().toLowerCase() !== "none") {
        memory.storeLesson(taskId, projectName, "reviewer", `Issues to avoid: ${issuesMatch[1].trim()}`);
      }
    } catch {}
  }
  
  // Store conversation history
  memory.storeConversation(taskId, "user", undefined, task.summary);
  memory.storeConversation(taskId, "assistant", "system", `Task completed with verdict: ${verdict}`);
}

// Generate a summary of what was built and how to use it
async function generateProjectSummary(
  taskId: string,
  task: Task,
  projectPath: string,
  createdFiles: string[]
): Promise<ProjectSummary> {
  // Read key files for context
  let codeContext = "";
  let packageJson: any = null;
  
  for (const filePath of createdFiles.slice(0, 5)) {
    try {
      const fullPath = path.join(projectPath, filePath);
      const content = fs.readFileSync(fullPath, "utf-8");
      codeContext += `\n--- ${filePath} ---\n${content.substring(0, 500)}\n`;
      
      if (filePath.includes("package.json")) {
        try {
          packageJson = JSON.parse(content);
        } catch {}
      }
    } catch {}
  }
  
  // Read architect.md for design decisions
  let architectureInfo = "";
  try {
    const archPath = path.join(projectPath, "architect.md");
    const archContent = await Bun.file(archPath).text();
    architectureInfo = archContent.substring(0, 1000);
  } catch {}
  
  // Detect tech stack
  let techStack = "Web Application";
  if (packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const tech: string[] = [];
    if (deps.react) tech.push("React");
    if (deps.next) tech.push("Next.js");
    if (deps.vue) tech.push("Vue");
    if (deps.express) tech.push("Express");
    if (deps.typescript) tech.push("TypeScript");
    if (deps.tailwindcss) tech.push("Tailwind CSS");
    if (tech.length > 0) techStack = tech.join(", ");
  } else if (createdFiles.some(f => f.endsWith(".html"))) {
    techStack = createdFiles.some(f => f.endsWith(".css")) ? "HTML/CSS/JS" : "HTML";
  }
  
  // Detect run instructions
  let runInstructions = "";
  if (packageJson) {
    if (packageJson.scripts?.dev) {
      runInstructions = "Run `npm run dev` to start the development server";
    } else if (packageJson.scripts?.start) {
      runInstructions = "Run `npm start` to start the application";
    } else {
      runInstructions = "Run `npm install` then check package.json for available scripts";
    }
  } else if (createdFiles.includes("index.html")) {
    runInstructions = "Open index.html in a web browser";
  } else {
    runInstructions = "Check the project files for usage instructions";
  }
  
  // Use AI to generate description and how-to-use
  const SUMMARY_PROMPT = `You are summarizing a software project that was just built. Based on the code and architecture, provide:
1. A brief description of what this app does (2-3 sentences)
2. How to use the main features

Project Name: ${task.project_name}
Original Request: ${task.summary}
Tech Stack: ${techStack}

Code Samples:
${codeContext}

${architectureInfo ? `Architecture Notes:\n${architectureInfo}` : ""}

Respond in this exact JSON format:
{
  "description": "Brief description of what the app does",
  "howToUse": "Step-by-step instructions for using the main features"
}`;

  let description = task.summary;
  let howToUse = "Explore the generated files to understand the features.";
  
  try {
    const { content } = await callAI(SUMMARY_PROMPT, "You are a helpful assistant that summarizes software projects. Respond only with valid JSON.");
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      description = parsed.description || description;
      howToUse = parsed.howToUse || howToUse;
    }
  } catch (error: any) {
    emitLog("system", "warn", `Failed to generate AI summary: ${error.message}`);
  }
  
  return {
    name: task.project_name,
    description,
    howToUse,
    filesCreated: createdFiles,
    techStack,
    runInstructions
  };
}

// API handlers
const server = serve({
  port: cfg.server.port,

  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // WebSocket
    if (url.pathname.startsWith("/ws/")) {
      const taskId = url.pathname.replace("/ws/", "");
      const upgraded = server.upgrade(req, { data: { taskId } });
      if (upgraded) return undefined;
    }

    // API routes
    if (url.pathname === "/api/tasks" && req.method === "GET") {
      const projectsDir = path.join(workspaceRoot, "projects");
      const tasks: any[] = [];

      try {
        const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const taskFile = path.join(projectsDir, entry.name, "task.md");
            try {
              const content = await Bun.file(taskFile).text();
              const frontmatter = readYamlFrontmatter(content);
              tasks.push({
                task_id: frontmatter.task_id || entry.name,
                project_name: frontmatter.project_name || entry.name,
                status: frontmatter.status || "unknown",
                created_at: frontmatter.created_at || null,
              });
            } catch {
              // Skip invalid tasks
            }
          }
        }
      } catch {
        // No projects yet
      }

      return Response.json(tasks, { headers: corsHeaders });
    }

    // Chat endpoint with Interface Agent
    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = await req.json();
      const { message, conversationHistory = [], currentTaskId: requestTaskId, specContext, projectContext: requestProjectContext } = body;

      try {
        // Get project context if there's a current task or provided in request
        let projectContext: any = requestProjectContext || undefined;
        const taskIdToUse = requestTaskId || currentTaskId;
        
        if (taskIdToUse && currentTask && !projectContext) {
          try {
            const projectPath = getProjectPath(taskIdToUse);
            const taskContent = await Bun.file(path.join(projectPath, "task.md")).text();
            const frontmatter = readYamlFrontmatter(taskContent);
            const filesCreated = collectCodeFiles(projectPath).map(f => f.path);
            
            let architecture = "";
            try {
              architecture = await Bun.file(path.join(projectPath, "architect.md")).text();
            } catch {}
            
            projectContext = {
              projectName: frontmatter.project_name || currentTask.project_name,
              taskDescription: frontmatter.summary || "",
              filesCreated,
              architecture
            };
          } catch {}
        }

        // Process through Interface Agent
        const interfaceResponse = await processInterfaceMessage(
          message,
          conversationHistory,
          currentTask ? { project_name: currentTask.project_name, status: pipelineRunning ? "running" : "complete" } : undefined,
          projectContext,
          specContext
        );

        // Store conversation in memory
        memory.storeConversation("chat", "user", "interface", message);
        memory.storeConversation("chat", "assistant", "interface", interfaceResponse.text);

        // If BUILD intent and confirmed, start pipeline
        if (interfaceResponse.intent === "BUILD" && !interfaceResponse.needsConfirmation) {
          const taskId = nanoid(8);
          const projectId = interfaceResponse.projectSummary?.name?.toLowerCase().replace(/\s+/g, "-") || taskId;

          const task: Task = {
            task_id: taskId,
            project_id: projectId,
            project_name: interfaceResponse.projectSummary?.name || "Untitled Project",
            summary: interfaceResponse.refinedRequirements || message,
            assumptions: ["User wants a working implementation"],
            stack_hint: interfaceResponse.projectSummary?.stack || "",
            complexity: "medium",
            tasks: ["Implement the requested feature"],
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          runPipeline(taskId, task);
        }

        return Response.json({ response: interfaceResponse }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json(
          { error: "Failed to process message", message: error.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (url.pathname === "/api/tasks" && req.method === "POST") {
      const body = await req.json();
      const taskId = nanoid(8);
      const projectId = body.project_name?.toLowerCase().replace(/\s+/g, "-") || taskId;

      const task: Task = {
        task_id: taskId,
        project_id: projectId,
        project_name: body.project_name || "Untitled Project",
        summary: body.summary || body.message?.slice(0, 100) || "",
        assumptions: body.assumptions || ["User wants a working implementation"],
        stack_hint: body.stack_hint || "",
        complexity: body.complexity || "medium",
        tasks: body.tasks || ["Implement the requested feature"],
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Start pipeline in background
      runPipeline(taskId, task);

      return Response.json({ task_id: taskId, status: "started" }, { headers: corsHeaders });
    }

    if (url.pathname.match(/^\/api\/tasks\/[^/]+$/)) {
      const taskId = url.pathname.replace("/api/tasks/", "");
      const taskFile = path.join(workspaceRoot, "projects", taskId, "task.md");

      try {
        const content = await Bun.file(taskFile).text();
        const frontmatter = readYamlFrontmatter(content);
        return Response.json(
          {
            task_id: taskId,
            ...frontmatter,
            content,
          },
          { headers: corsHeaders }
        );
      } catch {
        return Response.json({ error: "Task not found" }, { status: 404, headers: corsHeaders });
      }
    }

    // Task summary endpoint
    if (url.pathname.match(/^\/api\/tasks\/[^/]+\/summary$/)) {
      const taskId = url.pathname.replace("/api/tasks/", "").replace("/summary", "");
      const projectPath = getProjectPath(taskId);

      try {
        const taskContent = await Bun.file(path.join(projectPath, "task.md")).text();
        const frontmatter = readYamlFrontmatter(taskContent);

        // Extract summary from body (## Summary section)
        let description = frontmatter.summary || "";
        const summaryMatch = taskContent.match(/##\s*Summary\s*\n([\s\S]*?)(?=##|$)/i);
        if (summaryMatch && summaryMatch[1].trim()) {
          description = summaryMatch[1].trim();
        }

        let howToUse = "";
        
        // Extract stack hint from body (## Stack Hint section) or frontmatter
        let techStack = frontmatter.stack_hint || "";
        const stackMatch = taskContent.match(/##\s*Stack Hint\s*\n([\s\S]*?)(?=##|$)/i);
        if (stackMatch && stackMatch[1].trim()) {
          techStack = stackMatch[1].trim();
        }

        let runInstructions = "";

        // Extract Key Features or Key Objectives from planner.md for howToUse
        try {
          const plannerContent = await Bun.file(path.join(projectPath, "planner.md")).text();
          // Try "Key Features" first
          let featuresMatch = plannerContent.match(/###\s*Key Features([\s\S]*?)(?=---|##|$)/i);
          if (!featuresMatch) {
            // Try "Key Objectives"
            featuresMatch = plannerContent.match(/\*\*Key Objectives:\*\*([\s\S]*?)(?=##|$)/i);
          }
          if (!featuresMatch) {
            // Try "# Overview" section for objectives
            featuresMatch = plannerContent.match(/##\s*1\.\s*Overview([\s\S]*?)(?=##\s*2\.|---)/i);
          }
          if (featuresMatch) {
            howToUse = featuresMatch[1].trim();
          }
        } catch {}

        // Detect tech stack from files and architect if not in task.md
        if (!techStack || techStack === "Not specified") {
          try {
            const archContent = await Bun.file(path.join(projectPath, "architect.md")).text();
            const techMatches = archContent.match(/using\s+(React|Vue|Angular|Next\.js|Express|FastAPI|Python|TypeScript|JavaScript)/gi);
            if (techMatches) {
              techStack = [...new Set(techMatches.map(m => m.replace(/using\s+/i, "")))].join(", ");
            }
          } catch {}
        }

        // Detect from file extensions
        if (!techStack || techStack === "Not specified") {
          const files = collectCodeFiles(projectPath);
          const extensions = new Set(files.map(f => f.path.split('.').pop()));
          if (extensions.has('tsx') || extensions.has('jsx')) techStack = "React";
          else if (extensions.has('ts')) techStack = "TypeScript";
          else if (extensions.has('py')) techStack = "Python";
          else if (extensions.has('go')) techStack = "Go";
        }

        // Read README.md for run instructions (generated by documentor agent)
        try {
          const readmePath = path.join(projectPath, "README.md");
          if (fs.existsSync(readmePath)) {
            const readmeContent = await Bun.file(readmePath).text();
            
            // Extract Quick Start or Running section
            const quickStartMatch = readmeContent.match(/##\s*(?:Quick\s*Start|Running|How\s*to\s*Run)[\s\S]*?(?=##|$)/i);
            if (quickStartMatch) {
              // Extract commands from code blocks
              const commands = quickStartMatch[0].match(/```[^\n]*\n([\s\S]*?)```/g);
              if (commands && commands.length > 0) {
                // Clean up and format the commands
                const cmdText = commands.map(c => c.replace(/```[^\n]*\n?/g, '').replace(/```/g, '').trim()).filter(c => c).join('. ');
                if (cmdText) {
                  runInstructions = cmdText;
                }
              } else {
                // Use the section text directly
                runInstructions = quickStartMatch[0].replace(/#+\s*[^\n]+\n/gi, '').trim().substring(0, 500);
              }
            }
            
            // If no Quick Start, try Installation section
            if (!runInstructions) {
              const installMatch = readmeContent.match(/##\s*Installation[\s\S]*?(?=##|$)/i);
              if (installMatch) {
                runInstructions = installMatch[0].replace(/#+\s*[^\n]+\n/gi, '').trim().substring(0, 500);
              }
            }
          }
        } catch {}

        // Fallback: detect from tech stack first, then config files
        if (!runInstructions) {
          const lowerStack = techStack.toLowerCase();
          const hasPackageJson = fs.existsSync(path.join(projectPath, "package.json"));
          const hasRequirementsTxt = fs.existsSync(path.join(projectPath, "requirements.txt"));
          const hasGoMod = fs.existsSync(path.join(projectPath, "go.mod"));
          
          // Find entry point
          const files = collectCodeFiles(projectPath);
          const pythonEntry = files.find(f => f.path.endsWith('main.py') || f.path.endsWith('app.py'))?.path || "main.py";
          const jsEntry = files.find(f => f.path.endsWith('index.js') || f.path.endsWith('index.ts') || f.path.endsWith('main.ts'))?.path || "index.js";
          
          // Prioritize techStack over config files (config might be wrong from old builds)
          if (lowerStack.includes('python')) {
            if (hasRequirementsTxt) {
              runInstructions = `Navigate to the project folder. Run \`pip install -r requirements.txt\` to install dependencies. Run \`python ${pythonEntry}\` to start.`;
            } else {
              runInstructions = `Navigate to the project folder. Run \`python ${pythonEntry}\` to start.`;
            }
          } else if (lowerStack.includes('go')) {
            runInstructions = "Navigate to the project folder. Run `go mod download` then `go run main.go` to start.";
          } else if (lowerStack.includes('rust')) {
            runInstructions = "Navigate to the project folder. Run `cargo run` to start.";
          } else if (hasPackageJson) {
            try {
              const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, "package.json"), "utf-8"));
              const steps = ["Navigate to the project folder", "Run `npm install`"];
              if (pkg.scripts?.dev) steps.push("Run `npm run dev` to start");
              else if (pkg.scripts?.start) steps.push("Run `npm start` to start");
              else steps.push(`Run \`node ${jsEntry}\` to start`);
              runInstructions = steps.join(". ") + ".";
            } catch {
              runInstructions = `Navigate to the project folder. Run \`node ${jsEntry}\` to start.`;
            }
          } else if (hasRequirementsTxt) {
            runInstructions = `Navigate to the project folder. Run \`pip install -r requirements.txt\` to install dependencies. Run \`python ${pythonEntry}\` to start.`;
          } else if (hasGoMod) {
            runInstructions = "Navigate to the project folder. Run `go mod download` then `go run main.go` to start.";
          } else {
            runInstructions = "Check the project folder for README.md for setup instructions.";
          }
        }

        // Get files created
        const filesCreated = collectCodeFiles(projectPath).map(f => f.path);

        return Response.json({
          name: frontmatter.project_name || "Project",
          description,
          howToUse: howToUse || "Explore the generated files to understand the features.",
          filesCreated,
          techStack: techStack || "Web Application",
          runInstructions
        }, { headers: corsHeaders });
      } catch {
        return Response.json({ error: "Summary not found" }, { status: 404, headers: corsHeaders });
      }
    }

    // Task decisions endpoint
    if (url.pathname.match(/^\/api\/tasks\/[^/]+\/decisions$/)) {
      const taskId = url.pathname.replace("/api/tasks/", "").replace("/decisions", "");
      const projectPath = getProjectPath(taskId);

      try {
        const decisions: { decision: string; reason: string }[] = [];

        // Extract architecture decisions from architect.md
        try {
          const archContent = await Bun.file(path.join(projectPath, "architect.md")).text();
          
          // Pattern 1: "using X for Y" patterns
          const usingMatches = archContent.matchAll(/using\s+([^,.]+?)\s+for\s+([^.\n]+)/gi);
          for (const match of usingMatches) {
            const tech = match[1].trim();
            const purpose = match[2].trim();
            if (tech.length > 2 && tech.length < 50 && !tech.includes('I need')) {
              decisions.push({ decision: tech, reason: purpose });
            }
          }

          // Pattern 2: "X will be used for Y" patterns
          const willBeMatches = archContent.matchAll(/(\w+(?:\.\w+)?)\s+will be used\s+(?:for\s+)?([^.\n]+)/gi);
          for (const match of willBeMatches) {
            if (decisions.length < 5) {
              decisions.push({ decision: match[1].trim(), reason: match[2].trim() });
            }
          }

          // Pattern 3: Technology choices in context lines
          const techChoiceMatches = archContent.matchAll(/(\b(?:React|Vue|Angular|TypeScript|JavaScript|Node\.js|Express|FastAPI|Python|Vite|Tailwind|CSS)\b)[^.\n]*?(?:for|to enable|to provide|supports)[^.\n]+/gi);
          for (const match of techChoiceMatches) {
            if (decisions.length < 5) {
              const tech = match[1];
              const existing = decisions.find(d => d.decision.toLowerCase().includes(tech.toLowerCase()));
              if (!existing) {
                decisions.push({ decision: tech, reason: "Chosen for this project's requirements" });
              }
            }
          }
        } catch {}

        // Extract from planner.md Key Features if decisions are empty
        if (decisions.length === 0) {
          try {
            const plannerContent = await Bun.file(path.join(projectPath, "planner.md")).text();
            const featuresMatch = plannerContent.match(/###\s*Key Features([\s\S]*?)(?=---|##)/i);
            if (featuresMatch) {
              const featureLines = featuresMatch[1].match(/[-*]\s*(.+)/g) || [];
              for (const line of featureLines.slice(0, 4)) {
                const feature = line.replace(/^[-*]\s*/, "").trim();
                if (feature) {
                  decisions.push({ decision: feature, reason: "Core feature of the application" });
                }
              }
            }
          } catch {}
        }

        return Response.json({ decisions }, { headers: corsHeaders });
      } catch {
        return Response.json({ decisions: [] }, { headers: corsHeaders });
      }
    }

    // Task files endpoint
    if (url.pathname.match(/^\/api\/tasks\/[^/]+\/files$/)) {
      const taskId = url.pathname.replace("/api/tasks/", "").replace("/files", "");
      const projectPath = getProjectPath(taskId);

      try {
        const files: { path: string; content: string }[] = [];
        const codeFiles = collectCodeFiles(projectPath);

        for (const file of codeFiles.slice(0, 20)) {
          try {
            const content = fs.readFileSync(path.join(projectPath, file.path), "utf-8");
            files.push({ path: file.path, content });
          } catch {}
        }

        return Response.json({ files }, { headers: corsHeaders });
      } catch {
        return Response.json({ files: [] }, { headers: corsHeaders });
      }
    }

    // Task download endpoint (ZIP)
    if (url.pathname.match(/^\/api\/tasks\/[^/]+\/download$/)) {
      const taskId = url.pathname.replace("/api/tasks/", "").replace("/download", "");
      const projectPath = getProjectPath(taskId);

      try {
        // Create a simple tar-like response (for now, just return files)
        // In production, you'd use a proper zip library
        const files = collectCodeFiles(projectPath);
        const manifest = {
          taskId,
          projectName: currentTask?.project_name || "Project",
          files: files.map(f => f.path),
          createdAt: new Date().toISOString()
        };

        return Response.json(manifest, { headers: corsHeaders });
      } catch {
        return Response.json({ error: "Download failed" }, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/files/tree") {
      const tree = getFileTree(workspaceRoot);
      return Response.json({ tree }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/files/status") {
      const filePath = url.searchParams.get("path");
      if (!filePath) {
        return Response.json({ status: "unknown" }, { headers: corsHeaders });
      }

      const fullPath = path.join(workspaceRoot, filePath);
      try {
        const content = await Bun.file(fullPath).text();
        const frontmatter = readYamlFrontmatter(content);
        return Response.json({ status: frontmatter.status || "unknown" }, { headers: corsHeaders });
      } catch {
        return Response.json({ status: "unknown" }, { headers: corsHeaders });
      }
    }

    if (url.pathname.match(/^\/api\/files\//)) {
      const filePath = url.pathname.replace("/api/files/", "");
      const fullPath = path.join(workspaceRoot, filePath);

      try {
        const content = await Bun.file(fullPath).text();
        const frontmatter = readYamlFrontmatter(content);
        return Response.json(
          {
            path: filePath,
            content,
            frontmatter,
          },
          { headers: corsHeaders }
        );
      } catch {
        return Response.json({ error: "File not found" }, { status: 404, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/config") {
      return Response.json(
        {
          model: cfg.ai.model,
          base_url: cfg.ai.base_url,
          port: cfg.server.port,
        },
        { headers: corsHeaders }
      );
    }

    if (url.pathname === "/api/status") {
      return Response.json(
        {
          running: pipelineRunning,
          currentTaskId,
          agentStates,
        },
        { headers: corsHeaders }
      );
    }

    if (url.pathname === "/api/logs") {
      return Response.json({ logs: logBuffer.slice(-100) }, { headers: corsHeaders });
    }

    // Memory API endpoints
    if (url.pathname === "/api/memory/stats") {
      return Response.json({ stats: memory.getStats() }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/memory/search") {
      const query = url.searchParams.get("q") || "";
      const limit = parseInt(url.searchParams.get("limit") || "5");
      const results = memory.getRelevantMemories(query, limit);
      return Response.json({ results }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/memory/snippets") {
      const language = url.searchParams.get("language") || undefined;
      const limit = parseInt(url.searchParams.get("limit") || "10");
      
      let results;
      if (language) {
        results = memory.getMemoriesByLanguage(language, limit);
      } else {
        results = memory.getMemoriesByType("code_snippet", limit);
      }
      return Response.json({ results }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/memory/lessons") {
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const results = memory.getMemoriesByType("lesson", limit);
      return Response.json({ results }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/memory/clear" && req.method === "POST") {
      memory.clear();
      return Response.json({ success: true, message: "Memory cleared" }, { headers: corsHeaders });
    }

    // Marketing Agent endpoint
    if (url.pathname === "/api/marketing/generate" && req.method === "POST") {
      try {
        const body = await req.json();
        let { taskId, projectName, description, techStack, features } = body;
        
        if (!taskId) {
          return Response.json({ error: "taskId required" }, { status: 400, headers: corsHeaders });
        }
        
        const projectPath = getProjectPath(taskId);
        
        // Fetch project data from task.md if not provided
        if (!projectName) {
          try {
            const taskContent = await Bun.file(path.join(projectPath, "task.md")).text();
            const frontmatter = readYamlFrontmatter(taskContent);
            projectName = frontmatter.project_name || "Project";
            description = description || frontmatter.summary || taskContent.split("---").pop()?.trim().substring(0, 500) || "";
          } catch {
            projectName = "Project";
          }
        }
        
        // Get features from generated files
        if (!features || features.length === 0) {
          features = [];
          const codeFiles = collectCodeFiles(projectPath);
          for (const file of codeFiles.slice(0, 5)) {
            features.push(file.path);
          }
          if (features.length === 0) {
            features = ["Application"];
          }
        }
        
        emitStatus("marketing", "running", taskId);
        emitLog("marketing", "info", `Generating marketing materials for ${projectName}...`);
        
        const materials = await generateMarketingMaterials(
          projectName,
          description || "",
          techStack || "",
          features
        );
        
        await writeMarketingReport(projectPath, projectName, materials);
        
        emitStatus("marketing", "done", taskId);
        
        return Response.json({ 
          success: true, 
          materials,
          reportPath: `projects/${taskId}/MARKETING.md`
        }, { headers: corsHeaders });
      } catch (error: any) {
        emitStatus("marketing", "failed", "");
        emitLog("marketing", "error", `Failed to generate marketing: ${error.message}`);
        return Response.json({ 
          success: false, 
          error: error.message || "Failed to generate marketing materials" 
        }, { status: 500, headers: corsHeaders });
      }
    }

    // Social Media Agent endpoint
    if (url.pathname === "/api/social/generate" && req.method === "POST") {
      try {
        const body = await req.json();
        let { taskId, projectName, description, techStack, features, marketingCopy } = body;
        
        if (!taskId) {
          return Response.json({ error: "taskId required" }, { status: 400, headers: corsHeaders });
        }
        
        const projectPath = getProjectPath(taskId);
        
        // Fetch project data from task.md if not provided
        if (!projectName) {
          try {
            const taskContent = await Bun.file(path.join(projectPath, "task.md")).text();
            const frontmatter = readYamlFrontmatter(taskContent);
            projectName = frontmatter.project_name || "Project";
            description = description || frontmatter.summary || taskContent.split("---").pop()?.trim().substring(0, 500) || "";
          } catch {
            projectName = "Project";
          }
        }
        
        // Try to get marketing copy
        if (!marketingCopy) {
          try {
            const marketingContent = await Bun.file(path.join(projectPath, "MARKETING.md")).text();
            marketingCopy = marketingContent.substring(0, 500);
          } catch {}
        }
        
        // Get features from generated files
        if (!features || features.length === 0) {
          features = [];
          const codeFiles = collectCodeFiles(projectPath);
          for (const file of codeFiles.slice(0, 5)) {
            features.push(file.path);
          }
          if (features.length === 0) {
            features = ["Application"];
          }
        }
        
        emitStatus("social", "running", taskId);
        emitLog("social", "info", `Generating social media content for ${projectName}...`);
        
        const content = await generateSocialMediaContent(
          projectName,
          description || "",
          techStack || "",
          features,
          marketingCopy || ""
        );
        
        await writeSocialMediaReport(projectPath, projectName, content);
        
        emitStatus("social", "done", taskId);
        
        return Response.json({ 
          success: true, 
          content,
          reportPath: `projects/${taskId}/SOCIAL_MEDIA.md`
        }, { headers: corsHeaders });
      } catch (error: any) {
        emitStatus("social", "failed", "");
        emitLog("social", "error", `Failed to generate social media: ${error.message}`);
        return Response.json({ 
          success: false, 
          error: error.message || "Failed to generate social media content" 
        }, { status: 500, headers: corsHeaders });
      }
    }

    // Stop pipeline
    if (url.pathname === "/api/stop" && req.method === "POST") {
      if (pipelineRunning) {
        pipelineRunning = false;
        currentTaskId = null;
        
        // Reset all agent states
        for (const agent of Object.keys(agentStates)) {
          agentStates[agent] = "waiting";
        }
        
        emitLog("system", "info", "Pipeline stopped by user");
        return Response.json({ success: true, message: "Pipeline stopped" }, { headers: corsHeaders });
      }
      return Response.json({ success: false, message: "No pipeline running" }, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" }, { headers: corsHeaders });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },

  websocket: {
    open(ws: any) {
      wsClients.add(ws);
      emitLog("system", "info", "Client connected");

      // Send current state
      if (currentTaskId) {
        ws.send(JSON.stringify({ type: "task_started", task_id: currentTaskId }));
        for (const [agent, status] of Object.entries(agentStates)) {
          ws.send(JSON.stringify({ type: "agent_status", agent, status, task_id: currentTaskId }));
        }
      }

      // Send recent logs
      for (const log of logBuffer.slice(-20)) {
        ws.send(JSON.stringify(log));
      }
    },
    close(ws: any) {
      wsClients.delete(ws);
      emitLog("system", "info", "Client disconnected");
    },
    message(ws: any, message: string) {
      // Handle incoming messages if needed
    },
  },
});

console.log(`DevTeam backend running on port ${cfg.server.port}`);
console.log(`Workspace: ${workspaceRoot}`);
