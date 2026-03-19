// Executor Agent - Runs generated code and captures output
import { emitLog } from "./index";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  duration: number;
}

export interface ExecutorConfig {
  projectPath: string;
  installCommand: string;
  buildCommand: string;
  testCommand?: string;
  startCommand?: string;
  timeout: number;
}

/**
 * Execute code in the project directory
 * Runs: npm install && npm run build
 */
export async function executeProject(config: ExecutorConfig): Promise<ExecutionResult> {
  const startTime = Date.now();
  
  emitLog("executor", "info", `Starting execution in ${config.projectPath}`);
  
  try {
    // Check if project directory exists
    if (!fs.existsSync(config.projectPath)) {
      return {
        success: false,
        stdout: "",
        stderr: `Project directory not found: ${config.projectPath}`,
        exitCode: 1,
        command: "cd",
        duration: Date.now() - startTime
      };
    }
    
    // Check if package.json exists
    const packageJsonPath = path.join(config.projectPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return {
        success: false,
        stdout: "",
        stderr: "No package.json found - not a Node.js project",
        exitCode: 1,
        command: "package-check",
        duration: Date.now() - startTime
      };
    }
    
    // Run npm install
    emitLog("executor", "info", "Running: npm install");
    const installResult = await runCommand(config.projectPath, "npm", ["install"], config.timeout);
    
    if (installResult.exitCode !== 0) {
      emitLog("executor", "error", `npm install failed: ${installResult.stderr}`);
      return {
        ...installResult,
        command: "npm install",
        duration: Date.now() - startTime
      };
    }
    
    // Run npm run build (if build script exists)
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const hasBuildScript = packageJson.scripts && packageJson.scripts.build;
    
    if (hasBuildScript) {
      emitLog("executor", "info", "Running: npm run build");
      const buildResult = await runCommand(config.projectPath, "npm", ["run", "build"], config.timeout);
      
      if (buildResult.exitCode !== 0) {
        emitLog("executor", "error", `Build failed: ${buildResult.stderr}`);
        return {
          ...buildResult,
          command: "npm run build",
          duration: Date.now() - startTime
        };
      }
      
      emitLog("executor", "info", "Build successful!");
      return {
        ...buildResult,
        command: "npm run build",
        duration: Date.now() - startTime
      };
    } else {
      emitLog("executor", "info", "No build script found, skipping build");
      return {
        success: true,
        stdout: installResult.stdout + "\nNo build script found",
        stderr: "",
        exitCode: 0,
        command: "npm install (no build)",
        duration: Date.now() - startTime
      };
    }
  } catch (error: any) {
    emitLog("executor", "error", `Execution failed: ${error.message}`);
    return {
      success: false,
      stdout: "",
      stderr: error.message,
      exitCode: 1,
      command: "execution",
      duration: Date.now() - startTime
    };
  }
}

/**
 * Run a command in a specific directory
 */
async function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeout: number
): Promise<Omit<ExecutionResult, "duration" | "command">> {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: { ...process.env, CI: "true" }
    });
    
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeout);
    
    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
      emitLog("executor", "info", data.toString().trim());
    });
    
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      emitLog("executor", "warn", data.toString().trim());
    });
    
    proc.on("close", (code: number) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: timedOut ? -1 : code
      });
    });
    
    proc.on("error", (error: Error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout: "",
        stderr: error.message,
        exitCode: -1
      });
    });
  });
}

/**
 * Write execution result to debug log
 */
export async function writeExecutionLog(
  projectPath: string,
  result: ExecutionResult,
  iteration: number
): Promise<string> {
  const logContent = `# Execution Log - Iteration ${iteration}

## Command
\`\`\`bash
${result.command}
\`\`\`

## Result
${result.success ? "✅ **SUCCESS**" : "❌ **FAILED**"}

## Exit Code
${result.exitCode}

## Duration
${result.duration}ms

## Standard Output
\`\`\`
${result.stdout || "(empty)"}
\`\`\`

## Standard Error
\`\`\`
${result.stderr || "(none)"}
\`\`\`

## Status
${result.success ? "Ready for deployment" : "Requires debugging"}
`;

  const logPath = path.join(projectPath, "execution_log.md");
  await Bun.write(logPath, logContent);
  
  return logPath;
}
