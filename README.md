# comp03 - AI Development System

## 🚀 Quick Start

### Windows
```batch
# Double-click this file:
start.bat
```

### Manual
```bash
# Terminal 1 - Backend
cd mini-services/devteam-backend
bun --hot index.ts

# Terminal 2 - Frontend
npm run dev
```

**Open:** http://localhost:3000

---

## What is comp03?

**comp03** is an AI-powered multi-agent development system that builds complete applications from simple text descriptions.

### Features

✅ **Conversational Interface** - Chat naturally about what you want to build
✅ **12 AI Agents** - Specialized agents for planning, coding, testing, and more
✅ **Auto-Fix Loop** - Automatically fixes errors until code works
✅ **Web Search** - Researches latest best practices
✅ **Memory System** - Remembers your preferences and past projects
✅ **Marketing Tools** - Generates marketing and social media content

---

## The Agents

| Agent | Role |
|-------|------|
| **Interface** | Conversational gatekeeper |
| **Planner** | Creates implementation plan |
| **Researcher** | Web search + best practices |
| **Architect** | System architecture design |
| **Coder** | Writes actual code |
| **Reviewer** | Code review with PASS/FAIL |
| **Executor** | Runs and tests code |
| **Debugger** | Analyzes errors |
| **Resource** | Handles stubborn problems |
| **Marketing** | Creates marketing materials |
| **Social** | Generates social media content |
| **Orchestrator** | Coordinates everything |

---

## How It Works

### 1. Describe Your Project
```
You: "Create a file sharing app that works on Linux and Windows"
```

### 2. Interface Agent Responds
```
comp03: "Got it! A cross-platform file sharing app.
         ~25 files, ~5 minutes. Ready to build?"
         [✅ Start] [✏️ Edit]
```

### 3. Agents Build It
- Planner creates the plan
- Researcher finds best practices
- Architect designs the system
- Coder writes the code
- Reviewer validates it
- Executor runs and fixes errors

### 4. Get Working Code
Files appear in the sidebar, ready to use!

---

## Example Projects

- ✅ Login/Registration systems
- ✅ File sharing apps
- ✅ Weather dashboards
- ✅ Todo lists
- ✅ Calculator apps
- ✅ REST APIs
- ✅ React/Vue applications

---

## Commands

### Start
```bash
start.bat          # Full startup
start-simple.bat   # Quick start
```

### Stop
```bash
stop.bat           # Clean shutdown
```

### Check Status
```bash
# Backend
curl http://localhost:3030/api/status

# Frontend
curl http://localhost:3000
```

---

## System Requirements

- **Node.js** 18+
- **Bun** runtime
- **Windows** 10/11 (for .bat files)
- **LM Studio** (optional, for AI)

---

## Project Structure

```
comp03/
├── mini-services/devteam-backend/
│   ├── index.ts              # Main server
│   ├── interface-agent.ts    # Chat interface
│   ├── executor-agent.ts     # Code execution
│   ├── debugger-agent.ts     # Error analysis
│   ├── resource-agent.ts     # Problem solving
│   ├── marketing-agent.ts    # Marketing content
│   └── social-media-agent.ts # Social content
│
├── src/
│   ├── components/devteam/
│   │   ├── DevTeamApp.tsx    # Main UI
│   │   ├── ChatStream.tsx    # Chat interface
│   │   └── [components]
│   └── app/
│       ├── layout.tsx        # Root layout
│       └── page.tsx          # Main page
│
├── start.bat                 # Easy start
├── stop.bat                  # Easy stop
└── workspace/                # Generated projects
```

---

## API Endpoints

### Chat
```bash
POST /api/chat
{
  "message": "Create a login form",
  "conversationHistory": []
}
```

### Tasks
```bash
POST /api/tasks
{
  "message": "Calculator app",
  "project_name": "Calculator"
}
```

### Files
```bash
GET /api/files/tree      # List files
GET /api/files/:path     # Get file content
```

### Marketing
```bash
POST /api/marketing/generate
POST /api/social/generate
```

---

## Troubleshooting

### Backend won't start
```bash
# Check port
netstat -ano | findstr :3030

# Kill process
taskkill /F /PID <number>

# Restart
start.bat
```

### Frontend errors
```bash
# Clear cache
rm -rf .next

# Reinstall
npm install

# Restart
npm run dev
```

### Chat not responding
1. Check backend is running (port 3030)
2. Refresh browser
3. Check browser console

---

## Documentation

- `STARTUP_GUIDE.md` - How to start comp03
- `READY.md` - Quick reference
- `IMPLEMENTATION_COMPLETE_FINAL.md` - Technical details

---

## Support

**Logs:**
- Backend: `mini-services/devteam-backend/backend.log`
- Frontend: `frontend.log`

**Status:**
- Backend: http://localhost:3030/api/status
- Frontend: Check browser console

---

## License

Apache 2.0 License - Feel free to use and modify!

---

**comp03** - Your AI Development Partner 🚀

**Last Updated:** March 17, 2026
