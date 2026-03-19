// Debugger Agent - Analyzes execution errors and writes fix instructions
import { emitLog } from "./index";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";

export interface DebugAnalysis {
  errorType: string;
  errorHash: string;
  fileName?: string;
  lineNumber?: number;
  description: string;
  suggestedFix: string;
  isRepeated: boolean;
  repeatCount: number;
  requiresIntervention: boolean;
}

export interface DebugHistory {
  iterations: number;
  errorHashes: string[];
  lastErrors: Array<{
    iteration: number;
    errorHash: string;
    errorType: string;
  }>;
}

/**
 * Analyze execution errors and generate fix instructions
 */
export async function analyzeExecutionError(
  stderr: string,
  stdout: string,
  projectPath: string,
  history: DebugHistory
): Promise<DebugAnalysis> {
  emitLog("debugger", "info", "Analyzing execution errors...");
  
  const errorOutput = stderr || stdout;
  
  // Extract error type
  const errorType = extractErrorType(errorOutput);
  
  // Create hash from full error message
  const errorHash = createHash("sha256").update(errorOutput).digest("hex").substring(0, 16);
  
  // Check if this error has been seen before
  const isRepeated = history.errorHashes.includes(errorHash);
  const repeatCount = history.errorHashes.filter(h => h === errorHash).length;
  
  // Extract file name and line number if available
  const fileMatch = errorOutput.match(/(?:in|at|File)\s+[\'"]?([^\'"\s]+\.(ts|tsx|js|jsx))[:\s]/i);
  const lineMatch = errorOutput.match(/[:\s]line?\s*(\d+)/i);
  
  const fileName = fileMatch ? fileMatch[1] : undefined;
  const lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;
  
  // Generate description
  const description = generateErrorDescription(errorType, errorOutput);
  
  // Generate suggested fix
  const suggestedFix = await generateFixSuggestion(errorType, errorOutput, fileName);
  
  // Check if intervention is needed
  const requiresIntervention = repeatCount >= 3 || history.iterations >= 10;
  
  const analysis: DebugAnalysis = {
    errorType,
    errorHash,
    fileName,
    lineNumber,
    description,
    suggestedFix,
    isRepeated,
    repeatCount,
    requiresIntervention
  };
  
  emitLog("debugger", "info", `Error analysis complete: ${errorType} (repeated: ${isRepeated}, count: ${repeatCount})`);
  
  return analysis;
}

/**
 * Extract error type from error output
 */
function extractErrorType(errorOutput: string): string {
  const patterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /MODULE_NOT_FOUND/i, type: "MODULE_NOT_FOUND" },
    { pattern: /SyntaxError/i, type: "SYNTAX_ERROR" },
    { pattern: /TypeError/i, type: "TYPE_ERROR" },
    { pattern: /ReferenceError/i, type: "REFERENCE_ERROR" },
    { pattern: /TypeError.*Cannot read/i, type: "NULL_REFERENCE" },
    { pattern: /EADDRINUSE/i, type: "PORT_IN_USE" },
    { pattern: /ENOENT/i, type: "FILE_NOT_FOUND" },
    { pattern: /EACCES/i, type: "PERMISSION_DENIED" },
    { pattern: /TS\d+/i, type: "TYPESCRIPT_ERROR" },
    { pattern: /Error.*timeout/i, type: "TIMEOUT" },
    { pattern: /npm.*ERR/i, type: "NPM_ERROR" },
    { pattern: /command.*not found/i, type: "COMMAND_NOT_FOUND" }
  ];
  
  for (const { pattern, type } of patterns) {
    if (pattern.test(errorOutput)) {
      return type;
    }
  }
  
  return "UNKNOWN_ERROR";
}

/**
 * Generate human-readable error description
 */
function generateErrorDescription(errorType: string, errorOutput: string): string {
  const descriptions: Record<string, string> = {
    MODULE_NOT_FOUND: "A required Node.js module or package is missing",
    SYNTAX_ERROR: "There is a syntax error in the code",
    TYPE_ERROR: "A value is not of the expected type",
    REFERENCE_ERROR: "A variable or function is being referenced but doesn't exist",
    NULL_REFERENCE: "Trying to access a property of null or undefined",
    PORT_IN_USE: "The port is already in use by another process",
    FILE_NOT_FOUND: "A required file or directory doesn't exist",
    PERMISSION_DENIED: "Permission denied when accessing a file or resource",
    TYPESCRIPT_ERROR: "TypeScript compilation error",
    TIMEOUT: "The operation timed out",
    NPM_ERROR: "npm encountered an error",
    COMMAND_NOT_FOUND: "A command is not installed or not in PATH"
  };
  
  const baseDescription = descriptions[errorType] || "An unexpected error occurred";
  
  // Add specific error message
  const specificMatch = errorOutput.match(/(?:Error|error):\s*([^\n]+)/i);
  const specificMessage = specificMatch ? specificMatch[1].trim() : "";
  
  return specificMessage ? `${baseDescription}: ${specificMessage}` : baseDescription;
}

/**
 * Generate fix suggestion based on error type
 */
async function generateFixSuggestion(
  errorType: string,
  errorOutput: string,
  fileName?: string
): Promise<string> {
  const fixes: Record<string, string> = {
    MODULE_NOT_FOUND: `Install the missing module. Check package.json and run: npm install <package-name>`,
    SYNTAX_ERROR: `Check the syntax in ${fileName || "the code"}. Look for missing brackets, semicolons, or typos.`,
    TYPE_ERROR: `Verify the types match. Check function parameters and return values.`,
    REFERENCE_ERROR: `Make sure the variable or function is defined before use. Check imports and exports.`,
    NULL_REFERENCE: `Add null/undefined checks before accessing properties. Use optional chaining (?.) if appropriate.`,
    PORT_IN_USE: `Use a different port or kill the process using this port.`,
    FILE_NOT_FOUND: `Check the file path. Ensure the file exists and the path is correct.`,
    PERMISSION_DENIED: `Check file permissions. Run with appropriate permissions or fix ownership.`,
    TYPESCRIPT_ERROR: `Fix the TypeScript type errors. Check interfaces and type definitions.`,
    TIMEOUT: `Increase timeout or optimize the slow operation.`,
    NPM_ERROR: `Try clearing npm cache (npm cache clean --force) and reinstalling dependencies.`,
    COMMAND_NOT_FOUND: `Install the required package or check if it's in PATH.`
  };
  
  let fix = fixes[errorType] || "Review the error message and fix the identified issue.";
  
  // Add specific package name if MODULE_NOT_FOUND
  if (errorType === "MODULE_NOT_FOUND") {
    const packageMatch = errorOutput.match(/Cannot find module ['"]([^'"]+)['"]/);
    if (packageMatch) {
      fix = `Install the missing package: npm install ${packageMatch[1]}`;
    }
  }
  
  // Add file reference if available
  if (fileName) {
    fix += ` Check ${fileName} for issues.`;
  }
  
  return fix;
}

/**
 * Write debug analysis to debug_log.md
 */
export async function writeDebugLog(
  projectPath: string,
  analysis: DebugAnalysis,
  iteration: number
): Promise<string> {
  const logContent = `# Debug Log - Iteration ${iteration}

## Error Type
${analysis.errorType}

## Error Hash
${analysis.errorHash}

## Description
${analysis.description}

## Location
${analysis.fileName ? `File: ${analysis.fileName}` : "Unknown"}
${analysis.lineNumber ? `Line: ${analysis.lineNumber}` : ""}

## Suggested Fix
${analysis.suggestedFix}

## Status
- **Repeated Error:** ${analysis.isRepeated ? "Yes" : "No"}
- **Repeat Count:** ${analysis.repeatCount}
- **Requires Intervention:** ${analysis.requiresIntervention ? "Yes" : "No"}

## Next Steps
${analysis.requiresIntervention 
  ? "**ACTION REQUIRED:** This error has persisted. Resource Agent will be triggered." 
  : "Coder agent should implement the suggested fix."}
`;

  const logPath = path.join(projectPath, "debug_log.md");
  await Bun.write(logPath, logContent);
  
  emitLog("debugger", "info", `Debug log written to ${logPath}`);
  
  return logPath;
}

/**
 * Get or initialize debug history
 */
export function getDebugHistory(projectPath: string): DebugHistory {
  const historyPath = path.join(projectPath, ".debug_history.json");
  
  try {
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    emitLog("debugger", "warn", `Failed to read debug history: ${error}`);
  }
  
  return {
    iterations: 0,
    errorHashes: [],
    lastErrors: []
  };
}

/**
 * Update debug history
 */
export function updateDebugHistory(
  projectPath: string,
  history: DebugHistory,
  analysis: DebugAnalysis
): DebugHistory {
  history.iterations++;
  history.errorHashes.push(analysis.errorHash);
  history.lastErrors.push({
    iteration: history.iterations,
    errorHash: analysis.errorHash,
    errorType: analysis.errorType
  });
  
  // Keep only last 20 errors
  if (history.lastErrors.length > 20) {
    history.lastErrors = history.lastErrors.slice(-20);
  }
  
  // Save to file
  const historyPath = path.join(projectPath, ".debug_history.json");
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  
  return history;
}
