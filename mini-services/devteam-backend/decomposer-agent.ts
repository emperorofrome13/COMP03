// Decomposer Agent - Breaks complex projects into sub-tasks
import { callAI, emitLog } from "./index";

export interface SubTask {
  id: string;
  title: string;
  description: string;
  dependencies: string[]; // IDs of tasks this depends on
  estimatedFiles: number;
  estimatedTime: string;
  priority: number; // 1 = highest
  status: "pending" | "in_progress" | "complete" | "failed";
  taskId?: string; // Assigned task ID when executed
}

export interface DecompositionResult {
  originalRequest: string;
  subTasks: SubTask[];
  totalEstimatedFiles: number;
  totalEstimatedTime: string;
  complexity: "low" | "medium" | "high" | "very_high";
}

const DECOMPOSER_SYSTEM_PROMPT = `You are the Decomposer Agent for comp03, an AI-powered software development system.

Your role is to break down complex project requests into manageable sub-tasks.

**Guidelines:**

1. **Task Granularity**
   - Each sub-task should be completable in 5-15 minutes
   - Focus on logical boundaries (features, components, modules)
   - Ensure tasks can be built and tested independently

2. **Dependency Management**
   - Identify task dependencies clearly
   - Foundation tasks first (setup, config, core utilities)
   - Feature tasks second
   - Integration tasks last

3. **Task Structure**
   - Clear, descriptive title
   - Detailed description with acceptance criteria
   - List of dependencies (which tasks must complete first)
   - Estimated file count and time

**Example Decomposition:**

Input: "Build e-commerce platform with payment processing"

Output:
1. Project setup and configuration
2. User authentication system
3. Product catalog with database models
4. Product search and filtering
5. Shopping cart functionality
6. Checkout process
7. Payment gateway integration
8. Order management
9. Email notifications
10. Admin dashboard

**Output Format:**
Respond in JSON format with:
{
  "subTasks": [
    {
      "id": "task_1",
      "title": "Project setup",
      "description": "Initialize project structure...",
      "dependencies": [],
      "estimatedFiles": 5,
      "estimatedTime": "5 minutes",
      "priority": 1
    }
  ],
  "complexity": "high",
  "totalEstimatedFiles": 50,
  "totalEstimatedTime": "2 hours"
}`;

/**
 * Decompose a complex request into sub-tasks
 */
export async function decomposeProject(
  request: string,
  stackHint?: string
): Promise<DecompositionResult> {
  emitLog("decomposer", "info", `Decomposing project: ${request.substring(0, 100)}...`);
  
  const contextInfo = stackHint ? `\n\nTech Stack: ${stackHint}` : "";
  
  const userPrompt = `Decompose this project request into sub-tasks:

Project: ${request}${contextInfo}

Break it down into logical, independently buildable sub-tasks.
Consider:
- Foundation/setup tasks first
- Core features second
- Integration and polish last
- Dependencies between tasks

Output in JSON format with sub-tasks array.`;

  try {
    const { content } = await callAI(userPrompt, DECOMPOSER_SYSTEM_PROMPT);
    
    // Parse decomposition from AI output
    const result = parseDecomposition(content, request);
    
    emitLog("decomposer", "info", 
      `Decomposed into ${result.subTasks.length} tasks (${result.complexity} complexity)`
    );
    
    return result;
  } catch (error: any) {
    emitLog("decomposer", "error", `Decomposition failed: ${error.message}`);
    
    // Fallback: treat as single task
    return {
      originalRequest: request,
      subTasks: [{
        id: "task_1",
        title: "Build complete project",
        description: request,
        dependencies: [],
        estimatedFiles: 20,
        estimatedTime: "30 minutes",
        priority: 1,
        status: "pending"
      }],
      totalEstimatedFiles: 20,
      totalEstimatedTime: "30 minutes",
      complexity: "medium"
    };
  }
}

/**
 * Parse decomposition from AI output
 */
function parseDecomposition(content: string, originalRequest: string): DecompositionResult {
  const defaultResult: DecompositionResult = {
    originalRequest,
    subTasks: [],
    totalEstimatedFiles: 0,
    totalEstimatedTime: "Unknown",
    complexity: "medium"
  };
  
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback to single task
      return {
        ...defaultResult,
        subTasks: [{
          id: "task_1",
          title: "Build project",
          description: originalRequest,
          dependencies: [],
          estimatedFiles: 15,
          estimatedTime: "20 minutes",
          priority: 1,
          status: "pending"
        }],
        totalEstimatedFiles: 15,
        totalEstimatedTime: "20 minutes"
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Parse sub-tasks
    const subTasks: SubTask[] = (parsed.subTasks || []).map((task: any, index: number) => ({
      id: task.id || `task_${index + 1}`,
      title: task.title || `Task ${index + 1}`,
      description: task.description || "",
      dependencies: task.dependencies || [],
      estimatedFiles: task.estimatedFiles || 10,
      estimatedTime: task.estimatedTime || "15 minutes",
      priority: task.priority || (index + 1),
      status: "pending" as const
    }));
    
    // If no sub-tasks, create a default one
    if (subTasks.length === 0) {
      subTasks.push({
        id: "task_1",
        title: "Build project",
        description: originalRequest,
        dependencies: [],
        estimatedFiles: 15,
        estimatedTime: "20 minutes",
        priority: 1,
        status: "pending"
      });
    }
    
    return {
      originalRequest,
      subTasks,
      totalEstimatedFiles: parsed.totalEstimatedFiles || subTasks.reduce((sum, t) => sum + (t.estimatedFiles || 10), 0),
      totalEstimatedTime: parsed.totalEstimatedTime || calculateTotalTime(subTasks),
      complexity: parsed.complexity || "medium"
    };
  } catch (error) {
    emitLog("decomposer", "warn", `Failed to parse decomposition, using fallback`);
    
    // Fallback to single task
    return {
      originalRequest,
      subTasks: [{
        id: "task_1",
        title: "Build project",
        description: originalRequest,
        dependencies: [],
        estimatedFiles: 15,
        estimatedTime: "20 minutes",
        priority: 1,
        status: "pending"
      }],
      totalEstimatedFiles: 15,
      totalEstimatedTime: "20 minutes",
      complexity: "medium"
    };
  }
}

/**
 * Calculate total estimated time from sub-tasks
 */
function calculateTotalTime(subTasks: SubTask[]): string {
  const totalMinutes = subTasks.reduce((sum, task) => {
    const timeStr = task.estimatedTime || "15 minutes";
    const minutes = parseInt(timeStr.match(/(\d+)/)?.[1] || "15");
    return sum + minutes;
  }, 0);
  
  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`;
  } else {
    const hours = Math.round(totalMinutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
}

/**
 * Get next task to execute (respecting dependencies)
 */
export function getNextTask(
  subTasks: SubTask[],
  completedTaskIds: string[]
): SubTask | null {
  // Find tasks whose dependencies are all completed
  const availableTasks = subTasks.filter(task => {
    if (task.status === "complete") return false;
    if (task.status === "in_progress") return false;
    
    // Check if all dependencies are completed
    const allDepsComplete = task.dependencies.every(depId => 
      completedTaskIds.includes(depId)
    );
    
    return allDepsComplete;
  });
  
  if (availableTasks.length === 0) {
    return null;
  }
  
  // Sort by priority and return highest priority
  availableTasks.sort((a, b) => a.priority - b.priority);
  return availableTasks[0];
}

/**
 * Check if all tasks are complete
 */
export function allTasksComplete(subTasks: SubTask[]): boolean {
  return subTasks.every(task => task.status === "complete");
}

/**
 * Get decomposition progress
 */
export function getDecompositionProgress(subTasks: SubTask[]): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed: number;
  percentComplete: number;
} {
  const total = subTasks.length;
  const completed = subTasks.filter(t => t.status === "complete").length;
  const inProgress = subTasks.filter(t => t.status === "in_progress").length;
  const pending = subTasks.filter(t => t.status === "pending").length;
  const failed = subTasks.filter(t => t.status === "failed").length;
  
  return {
    total,
    completed,
    inProgress,
    pending,
    failed,
    percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}
