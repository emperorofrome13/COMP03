// Resource Agent - Handles stubborn errors using PUA methodology
import { emitLog } from "./index";
import path from "path";

export interface ResourceAnalysis {
  problemStatement: string;
  rootCause: string;
  solution: string;
  implementation: string;
  confidence: number;
  requiresPlannerReview: boolean;
}

/**
 * Analyze persistent errors using PUA methodology
 * PUA = Problem Understanding & Analysis
 * Reference: https://github.com/tanweai/pua
 */
export async function analyzePersistentError(
  errorType: string,
  errorDescription: string,
  debugHistory: any,
  projectContext: string
): Promise<ResourceAnalysis> {
  emitLog("resource", "info", "Analyzing persistent error with PUA methodology...");
  
  // PUA Methodology:
  // 1. Problem Statement - Clearly define what's wrong
  // 2. Root Cause Analysis - Find why it's happening
  // 3. Solution Design - Plan how to fix it
  // 4. Implementation - Provide exact fix
  
  const problemStatement = formulateProblemStatement(errorType, errorDescription);
  const rootCause = await analyzeRootCause(errorType, errorDescription, debugHistory, projectContext);
  const solution = designSolution(rootCause, projectContext);
  const implementation = generateImplementation(solution);
  
  // Determine if planner review is needed
  const requiresPlannerReview = debugHistory.iterations >= 10;
  
  const analysis: ResourceAnalysis = {
    problemStatement,
    rootCause,
    solution,
    implementation,
    confidence: calculateConfidence(errorType, debugHistory),
    requiresPlannerReview
  };
  
  emitLog("resource", "info", `Resource analysis complete. Confidence: ${analysis.confidence}`);
  
  return analysis;
}

/**
 * Step 1: Formulate clear problem statement
 */
function formulateProblemStatement(errorType: string, errorDescription: string): string {
  return `The system is experiencing a ${errorType} that has persisted through multiple fix attempts. 

Specific Issue: ${errorDescription}

Impact: The application cannot build or run successfully, blocking deployment.`;
}

/**
 * Step 2: Analyze root cause using pattern matching
 */
async function analyzeRootCause(
  errorType: string,
  errorDescription: string,
  debugHistory: any,
  projectContext: string
): Promise<string> {
  // Common root causes by error type
  const rootCauses: Record<string, string[]> = {
    MODULE_NOT_FOUND: [
      "Missing dependency in package.json",
      "Incorrect import path or module name",
      "Dependency version incompatibility",
      "Node modules not properly installed"
    ],
    SYNTAX_ERROR: [
      "Typo or missing character in code",
      "Incorrect TypeScript/JavaScript syntax",
      "Missing or extra brackets/parentheses",
      "Incorrect import/export syntax"
    ],
    TYPE_ERROR: [
      "Type mismatch between expected and actual values",
      "Missing type definitions",
      "Incorrect generic type parameters",
      "Union type not properly handled"
    ],
    PORT_IN_USE: [
      "Another process is using the same port",
      "Previous server instance not properly closed",
      "Port conflict with system service"
    ]
  };
  
  const possibleCauses = rootCauses[errorType] || ["Unknown root cause - requires manual investigation"];
  
  // Analyze debug history for patterns
  if (debugHistory.lastErrors && debugHistory.lastErrors.length > 0) {
    const sameErrors = debugHistory.lastErrors.filter((e: any) => e.errorType === errorType);
    if (sameErrors.length >= 3) {
      return `This ${errorType} has occurred ${sameErrors.length} times, suggesting a fundamental issue rather than a simple typo. The fix attempts have not addressed the root cause.`;
    }
  }
  
  // Return most likely cause
  return `Most likely cause: ${possibleCauses[0]}. Additional possibilities: ${possibleCauses.slice(1).join(", ")}.`;
}

/**
 * Step 3: Design solution based on root cause
 */
function designSolution(rootCause: string, projectContext: string): string {
  return `Based on the root cause analysis:

1. **Immediate Action**: Address the primary cause identified
2. **Verification**: Test the fix thoroughly
3. **Prevention**: Add checks to prevent recurrence

Specific steps:
- Review the problematic code section
- Apply the corrected implementation
- Run build/tests to verify fix
- Update dependencies if needed`;
}

/**
 * Step 4: Generate specific implementation
 */
function generateImplementation(solution: string): string {
  return `Implementation Plan:

1. Identify the exact file and line causing the issue
2. Apply the fix based on the solution design
3. Run: npm install (if dependency issue)
4. Run: npm run build
5. Verify: Check for new errors
6. Test: Run the application

If this fix doesn't work, the issue may require architectural changes or external dependencies.`;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(errorType: string, debugHistory: any): number {
  // Start with base confidence by error type
  const baseConfidence: Record<string, number> = {
    MODULE_NOT_FOUND: 0.9,
    SYNTAX_ERROR: 0.85,
    TYPE_ERROR: 0.75,
    PORT_IN_USE: 0.95,
    FILE_NOT_FOUND: 0.9
  };
  
  let confidence = baseConfidence[errorType] || 0.7;
  
  // Reduce confidence if many iterations
  if (debugHistory.iterations > 5) {
    confidence -= 0.1;
  }
  if (debugHistory.iterations > 10) {
    confidence -= 0.2;
  }
  
  // Reduce confidence if same error repeated
  const sameErrors = debugHistory.lastErrors?.filter((e: any) => e.errorType === errorType) || [];
  if (sameErrors.length >= 3) {
    confidence -= 0.15;
  }
  
  return Math.max(0.3, confidence); // Minimum 30% confidence
}

/**
 * Write resource report to file
 */
export async function writeResourceReport(
  projectPath: string,
  analysis: ResourceAnalysis,
  iteration: number
): Promise<string> {
  const reportContent = `# Resource Agent Report - Iteration ${iteration}

## Problem Statement
${analysis.problemStatement}

## Root Cause Analysis
${analysis.rootCause}

## Solution Design
${analysis.solution}

## Implementation Plan
${analysis.implementation}

## Confidence Score
${(analysis.confidence * 100).toFixed(0)}%

## Review Required
${analysis.requiresPlannerReview ? "⚠️ **YES** - Planner review required (10+ iterations)" : "No"}

---
*Generated by Resource Agent using PUA methodology*
`;

  const reportPath = path.join(projectPath, "resource_report.md");
  await Bun.write(reportPath, reportContent);
  
  emitLog("resource", "info", `Resource report written to ${reportPath}`);
  
  return reportPath;
}

/**
 * Contact planner for intervention
 */
export async function contactPlanner(
  projectPath: string,
  analysis: ResourceAnalysis,
  fullErrorLog: string
): Promise<string> {
  const message = `# Planner Intervention Required

## Situation
The Executor Loop has reached 10 iterations without success.

## Error Summary
${analysis.problemStatement}

## Root Cause
${analysis.rootCause}

## Attempts Made
The system has attempted multiple fixes without success.

## Recommendation
Human intervention or architectural redesign may be required.

## Full Error Log
\`\`\`
${fullErrorLog.substring(0, 2000)}
\`\`\`

---
**Action Required:** Please review and provide guidance.
`;

  const interventionPath = path.join(projectPath, "planner_intervention.md");
  await Bun.write(interventionPath, message);
  
  emitLog("resource", "warn", "Planner intervention requested");
  
  return interventionPath;
}
