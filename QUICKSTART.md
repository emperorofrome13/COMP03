# DevTeam - Easy Start Guide

## Quick Start (Windows)

### Method 1: Double-Click start.bat

1. Navigate to the `devteam-multi-agent-system` folder
2. Double-click `start.bat`
3. Wait for both servers to start
4. Your browser will automatically open to http://localhost:3000

### Method 2: Command Line

```bash
# From the devteam-multi-agent-system directory
start.bat
```

## Stopping the Servers

### Method 1: Double-Click stop.bat

1. Navigate to the `devteam-multi-agent-system` folder
2. Double-click `stop.bat`
3. Both servers will be stopped automatically

### Method 2: Manual

- Close the backend and frontend command windows
- Or press `Ctrl+C` in each window

---

## Manual Start (All Platforms)

### Windows

```bash
# Terminal 1 - Backend
cd mini-services\devteam-backend
bun --hot index.ts

# Terminal 2 - Frontend (new window)
npm run dev
```

### macOS / Linux

```bash
# Terminal 1 - Backend
cd mini-services/devteam-backend
bun --hot index.ts

# Terminal 2 - Frontend
npm run dev
```

---

## Prerequisites

Make sure you have the following installed:

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Bun** - [Install](https://bun.sh/)
   ```bash
   npm install -g bun
   ```
3. **LM Studio** (or compatible AI server) - [Download](https://lmstudio.ai/)
   - Load a model in LM Studio
   - Start the server on port 1234

---

## What Gets Started

When you run `start.bat`, it:

1. ✅ Checks if Node.js and Bun are installed
2. ✅ Installs backend dependencies (if needed)
3. ✅ Installs frontend dependencies (if needed)
4. ✅ Starts the backend server on port 3030
5. ✅ Waits for backend to initialize
6. ✅ Starts the frontend server on port 3000
7. ✅ Opens your browser to the app

### Server Windows

Two command windows will open:

- **DevTeam Backend** - Shows AI agent activity, logs, and API requests
- **DevTeam Frontend** - Shows Next.js compilation and frontend logs

---

## New Features

### 1. Web Search for Researcher Agent 🌐

The Researcher agent now performs **live web searches** to find:
- Latest best practices and tutorials
- Current library recommendations
- Up-to-date documentation
- Code examples and guides

**How it works:**
- When a task starts, Researcher searches the web for relevant information
- Search results are combined with memory context
- AI generates research report using both sources
- Results are more current and comprehensive

**Example output includes:**
- Links to official documentation
- Recent tutorials and guides
- Current library versions
- Best practices for 2024

### 2. File-Based Memory System 🧠

The system now **remembers** everything it has built:

**What's stored:**
- All generated code snippets
- Patterns (functions, classes, components)
- Lessons learned from code reviews
- Conversation history

**Benefits:**
- Each new task learns from previous work
- Similar projects get smarter suggestions
- Code quality improves over time
- No need to re-explain preferences

**Memory API:**
```bash
# Check memory stats
curl http://localhost:3030/api/memory/stats

# Search memories
curl "http://localhost:3030/api/memory/search?q=form%20validation"

# Get code snippets
curl "http://localhost:3030/api/memory/snippets?language=typescript"

# Get lessons learned
curl "http://localhost:3030/api/memory/lessons"
```

### 3. Rich Agent Context 🔄

Agents now see **full context** from previous agents:

- **Planner** → Creates implementation plan
- **Researcher** → Sees plan + web search + memories
- **Architect** → Sees plan + research + memories
- **Coder** → Sees full architecture + all context
- **Reviewer** → Sees everything + generated files

This results in:
- More coherent implementations
- Better alignment with requirements
- Fewer mistakes and omissions
- Higher quality code

---

## Configuration

### Edit config.yaml

Location: `mini-services/devteam-backend/config.yaml`

```yaml
ai:
  base_url: "http://localhost:1234/v1"  # LM Studio URL
  api_key: "lm-studio"                  # API key
  model: "auto-detect"                  # Auto-detects loaded model
  max_tokens: 8192
  temperature: 0.2

tools:
  search_enabled: true   # Enable web search
  exec_enabled: true     # Enable code execution (future)

memory:
  max_context_tokens: 6000  # Memory context size
```

---

## Troubleshooting

### Backend won't start

**Error:** Port 3030 already in use

```bash
# Find and kill the process
netstat -ano | findstr :3030
taskkill /F /PID <process_id>
```

### Frontend won't start

**Error:** Module not found

```bash
# Reinstall dependencies
npm install
```

### LM Studio not responding

1. Make sure LM Studio is running
2. Load a model in LM Studio
3. Start the server (Server tab → Start Server)
4. Check the model is loaded

### Web search not working

Web search uses DuckDuckGo's HTML interface. If it fails:
- System automatically falls back to knowledge base
- Still generates good research from internal knowledge
- No API key required for fallback

---

## Project Structure

```
devteam-multi-agent-system/
├── start.bat              # Easy start script
├── stop.bat               # Easy stop script
├── mini-services/
│   └── devteam-backend/
│       ├── index.ts       # Main backend
│       ├── memory.ts      # Memory system
│       ├── search.ts      # Web search
│       └── config.yaml    # Configuration
└── src/
    └── app/
        └── api/
            ├── memory/    # Memory API routes
            ├── files/     # File operations
            └── tasks/     # Task management
```

---

## Usage Examples

### Create a Task via UI

1. Open http://localhost:3000
2. Type your project description
3. Press Ctrl+Enter or click Send
4. Watch the agents work in real-time

### Create a Task via API

```bash
curl -X POST http://localhost:3030/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a login form with validation",
    "project_name": "Login App",
    "stack_hint": "React TypeScript"
  }'
```

### Check Task Status

```bash
curl http://localhost:3030/api/status
```

### View Generated Files

```bash
# List all projects
curl http://localhost:3030/api/files/tree

# View specific file
curl "http://localhost:3030/api/files/projects/{task_id}/index.html"
```

---

## Performance Tips

1. **Use a fast model** - Qwen2.5-Coder-32B or similar works well
2. **Keep LM Studio loaded** - Don't unload the model between tasks
3. **Clear memory occasionally** - Use `/api/memory/clear` if it gets too large
4. **Run on SSD** - File operations are faster
5. **Close other apps** - Give LM Studio enough RAM

---

## Support

For issues or questions:
- Check the backend logs for AI errors
- Check the frontend logs for UI errors
- Verify LM Studio is running with a loaded model
- Review the memory stats to ensure it's working

---

## What's Next?

Future enhancements:
- [ ] Vector embeddings for semantic search
- [ ] External web search API integration
- [ ] Code execution sandbox for testing
- [ ] UI for browsing memories
- [ ] Memory export/import
- [ ] User preference learning

Enjoy building with DevTeam! 🚀
