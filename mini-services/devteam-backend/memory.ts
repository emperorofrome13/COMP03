// File-based memory system for DevTeam
import path from "path";
import fs from "fs";

export interface Memory {
  id: string;
  type: "code_snippet" | "pattern" | "lesson" | "preference" | "component";
  category: string;
  content: string;
  metadata: {
    task_id?: string;
    project_name?: string;
    agent?: string;
    language?: string;
    tags?: string[];
    created_at: string;
    usage_count: number;
  };
}

export interface ConversationHistory {
  task_id: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    agent?: string;
    content: string;
    timestamp: string;
  }>;
}

export class MemorySystem {
  private memoryDir: string;
  private historyDir: string;
  private indexFile: string;
  private memories: Memory[] = [];

  constructor(workspaceRoot: string) {
    this.memoryDir = path.join(workspaceRoot, ".memory");
    this.historyDir = path.join(this.memoryDir, "history");
    this.indexFile = path.join(this.memoryDir, "index.json");
    
    // Initialize directories
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
    
    // Load existing memories
    this.loadMemories();
  }

  private loadMemories() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const data = fs.readFileSync(this.indexFile, "utf-8");
        this.memories = JSON.parse(data);
      } catch (error) {
        console.error("Failed to load memories:", error);
        this.memories = [];
      }
    }
  }

  private saveMemories() {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(this.memories, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save memories:", error);
    }
  }

  // Add a new memory
  addMemory(memory: Omit<Memory, "id" | "metadata"> & { metadata?: Partial<Memory["metadata"]> }): Memory {
    const newMemory: Memory = {
      ...memory,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        created_at: new Date().toISOString(),
        usage_count: 0,
        ...memory.metadata,
      },
    };

    this.memories.push(newMemory);
    this.saveMemories();

    // Save full content to separate file
    const memoryFile = path.join(this.memoryDir, `${newMemory.id}.json`);
    fs.writeFileSync(memoryFile, JSON.stringify(newMemory, null, 2), "utf-8");

    return newMemory;
  }

  // Store code snippet from generated files
  storeCodeSnippet(filePath: string, content: string, taskId: string, projectName: string) {
    const ext = path.extname(filePath).toLowerCase();
    let language = "unknown";
    let category = "other";

    // Determine language and category
    if (ext === ".ts" || ext === ".tsx") {
      language = "typescript";
      category = filePath.includes("component") ? "components" : filePath.includes("controller") ? "controllers" : "modules";
    } else if (ext === ".js" || ext === ".jsx") {
      language = "javascript";
      category = filePath.includes("component") ? "components" : "modules";
    } else if (ext === ".html") {
      language = "html";
      category = "templates";
    } else if (ext === ".css" || ext === ".scss") {
      language = "css";
      category = "styles";
    } else if (ext === ".json") {
      language = "json";
      category = "config";
    } else if (ext === ".md") {
      language = "markdown";
      category = "documentation";
    }

    // Extract key patterns from code
    const patterns = this.extractPatterns(content, language);

    // Store the code snippet
    this.addMemory({
      type: "code_snippet",
      category,
      content,
      metadata: {
        task_id: taskId,
        project_name: projectName,
        language,
        tags: patterns,
      },
    });

    // Also store any patterns found
    for (const pattern of patterns) {
      this.addMemory({
        type: "pattern",
        category: `${language}_${category}`,
        content: pattern,
        metadata: {
          task_id: taskId,
          project_name: projectName,
          language,
          tags: [pattern],
        },
      });
    }
  }

  // Extract patterns from code
  private extractPatterns(content: string, language: string): string[] {
    const patterns: string[] = [];

    if (language === "typescript" || language === "javascript") {
      // Extract function names
      const funcMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
      for (const match of funcMatches) {
        patterns.push(`function:${match[1]}`);
      }

      // Extract class names
      const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)/g);
      for (const match of classMatches) {
        patterns.push(`class:${match[1]}`);
      }

      // Extract interface names
      const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)/g);
      for (const match of interfaceMatches) {
        patterns.push(`interface:${match[1]}`);
      }

      // Extract import statements
      const importMatches = content.matchAll(/import.*from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        patterns.push(`import:${match[1]}`);
      }
    } else if (language === "html") {
      // Extract component tags
      const tagMatches = content.matchAll(/<([a-z][a-z0-9-]*)/gi);
      for (const match of tagMatches) {
        if (!["div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img", "input", "button"].includes(match[1].toLowerCase())) {
          patterns.push(`component:${match[1]}`);
        }
      }
    }

    return [...new Set(patterns)]; // Remove duplicates
  }

  // Store lessons learned from reviewer
  storeLesson(taskId: string, projectName: string, agent: string, lesson: string) {
    this.addMemory({
      type: "lesson",
      category: agent,
      content: lesson,
      metadata: {
        task_id: taskId,
        project_name: projectName,
        agent,
        tags: ["lesson", "learning"],
      },
    });
  }

  // Store user preferences
  storePreference(category: string, preference: string) {
    // Remove old preferences in same category
    this.memories = this.memories.filter(m => 
      !(m.type === "preference" && m.category === category)
    );

    this.addMemory({
      type: "preference",
      category,
      content: preference,
      metadata: {
        tags: ["preference", "user-setting"],
      },
    });
  }

  // Get relevant memories for context
  getRelevantMemories(query: string, limit: number = 5): Memory[] {
    const queryLower = query.toLowerCase();
    
    // Score memories by relevance
    const scored = this.memories.map(memory => {
      let score = 0;
      const contentLower = memory.content.toLowerCase();
      const categoryLower = memory.category.toLowerCase();
      const tagsLower = (memory.metadata.tags || []).join(" ").toLowerCase();

      // Check for keyword matches
      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (word.length > 3) {
          if (contentLower.includes(word)) score += 3;
          if (categoryLower.includes(word)) score += 2;
          if (tagsLower.includes(word)) score += 2;
        }
      }

      // Boost by usage count
      score += memory.metadata.usage_count * 0.5;

      // Boost recent memories
      const memoryDate = new Date(memory.metadata.created_at);
      const daysOld = (Date.now() - memoryDate.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysOld) * 0.1;

      return { memory, score };
    });

    // Sort by score and return top results
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ memory }) => {
        // Increment usage count
        memory.metadata.usage_count++;
        return memory;
      });
  }

  // Get memories by type
  getMemoriesByType(type: Memory["type"], limit: number = 10): Memory[] {
    return this.memories
      .filter(m => m.type === type)
      .sort((a, b) => b.metadata.usage_count - a.metadata.usage_count)
      .slice(0, limit);
  }

  // Get memories by category
  getMemoriesByCategory(category: string, limit: number = 10): Memory[] {
    return this.memories
      .filter(m => m.category === category || m.category.startsWith(category))
      .sort((a, b) => b.metadata.usage_count - a.metadata.usage_count)
      .slice(0, limit);
  }

  // Get memories by language
  getMemoriesByLanguage(language: string, limit: number = 10): Memory[] {
    return this.memories
      .filter(m => m.metadata.language === language)
      .sort((a, b) => b.metadata.usage_count - a.metadata.usage_count)
      .slice(0, limit);
  }

  // Store conversation history
  storeConversation(taskId: string, role: string, agent: string | undefined, content: string) {
    const historyFile = path.join(this.historyDir, `${taskId}.json`);
    let history: ConversationHistory = { task_id: taskId, messages: [] };

    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, "utf-8"));
      } catch {
        history = { task_id: taskId, messages: [] };
      }
    }

    history.messages.push({
      role: role as "user" | "assistant" | "system",
      agent,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep last 50 messages
    if (history.messages.length > 50) {
      history.messages = history.messages.slice(-50);
    }

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf-8");
  }

  // Get conversation history
  getConversation(taskId: string): ConversationHistory | null {
    const historyFile = path.join(this.historyDir, `${taskId}.json`);
    
    if (!fs.existsSync(historyFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    } catch {
      return null;
    }
  }

  // Get all conversations
  getAllConversations(): ConversationHistory[] {
    const conversations: ConversationHistory[] = [];
    
    try {
      const files = fs.readdirSync(this.historyDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const history = this.getConversation(file.replace(".json", ""));
          if (history) {
            conversations.push(history);
          }
        }
      }
    } catch {}

    return conversations;
  }

  // Generate context prompt for agents
  generateContextPrompt(agent: string, taskDescription: string): string {
    const contexts: string[] = [];

    // Get relevant memories
    const relevantMemories = this.getRelevantMemories(taskDescription, 5);
    if (relevantMemories.length > 0) {
      contexts.push("\n## Relevant Past Work\n");
      for (const memory of relevantMemories) {
        contexts.push(`- [${memory.type}] ${memory.category}: ${memory.content.substring(0, 200)}...`);
      }
    }

    // Get agent-specific lessons
    const lessons = this.getMemoriesByType("lesson").filter(m => 
      !agent || m.metadata.agent === agent || m.category === agent
    ).slice(0, 3);
    
    if (lessons.length > 0) {
      contexts.push("\n## Lessons Learned\n");
      for (const lesson of lessons) {
        contexts.push(`- ${lesson.content}`);
      }
    }

    // Get user preferences
    const preferences = this.getMemoriesByType("preference");
    if (preferences.length > 0) {
      contexts.push("\n## User Preferences\n");
      for (const pref of preferences) {
        contexts.push(`- ${pref.content}`);
      }
    }

    return contexts.join("\n");
  }

  // Get statistics
  getStats() {
    return {
      totalMemories: this.memories.length,
      byType: {
        code_snippet: this.memories.filter(m => m.type === "code_snippet").length,
        pattern: this.memories.filter(m => m.type === "pattern").length,
        lesson: this.memories.filter(m => m.type === "lesson").length,
        preference: this.memories.filter(m => m.type === "preference").length,
      },
      totalConversations: fs.readdirSync(this.historyDir).filter(f => f.endsWith(".json")).length,
    };
  }

  // Clear all memories (for testing)
  clear() {
    this.memories = [];
    this.saveMemories();
    
    // Clear memory files
    try {
      const files = fs.readdirSync(this.memoryDir);
      for (const file of files) {
        if (file.endsWith(".json") && file !== "index.json") {
          fs.unlinkSync(path.join(this.memoryDir, file));
        }
      }
      
      // Clear history files
      const historyFiles = fs.readdirSync(this.historyDir);
      for (const file of historyFiles) {
        if (file.endsWith(".json")) {
          fs.unlinkSync(path.join(this.historyDir, file));
        }
      }
    } catch {}
  }
}
