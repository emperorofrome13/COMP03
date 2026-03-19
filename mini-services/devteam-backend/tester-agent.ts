// Tester Agent - Generates and runs unit tests
import { callAI, emitLog } from "./index";
import path from "path";
import fs from "fs";

export interface TestResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  output: string;
  coverage?: number;
}

const TESTER_SYSTEM_PROMPT = `You are the Tester Agent for comp03, an AI-powered software development system.

Your role is to:
1. Generate unit tests for generated code
2. Ensure test coverage for critical functions
3. Create test files that follow best practices
4. Use appropriate testing frameworks (Jest, Vitest, etc.)

**Output Format:**
For each test file, output in this format:

Filename: src/__tests__/function.test.ts
\`\`\`typescript
import { functionName } from '../function';

describe('functionName', () => {
  it('should work correctly', () => {
    // Test implementation
  });
});
\`\`\`

**Guidelines:**
- Test all exported functions
- Cover edge cases
- Include both positive and negative test cases
- Use descriptive test names
- Follow Arrange-Act-Assert pattern

Output ONLY the test files in the specified format.`;

/**
 * Generate unit tests for the project
 */
export async function generateTests(
  taskId: string,
  projectPath: string,
  codeFiles: Array<{ path: string; content: string }>
): Promise<{ testFiles: Array<{ path: string; content: string }>; count: number }> {
  emitLog("tester", "info", `Generating tests for ${codeFiles.length} files...`);
  
  // Prepare code context for AI
  const codeContext = codeFiles
    .filter(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx') || f.path.endsWith('.js') || f.path.endsWith('.jsx'))
    .filter(f => !f.path.includes('__tests__') && !f.path.includes('.test.') && !f.path.includes('.spec.'))
    .slice(0, 10) // Limit to 10 files to avoid token limits
    .map(f => `// File: ${f.path}\n${f.content.substring(0, 1000)}`)
    .join('\n\n---\n\n');
  
  const userPrompt = `Generate comprehensive unit tests for this codebase:

Project Path: ${projectPath}

Code Files:
${codeContext}

Generate test files for all exported functions. Focus on:
1. Core business logic
2. Utility functions
3. API endpoints
4. Component rendering (for React components)

Use Jest/Vitest syntax. Output test files in the required format.`;

  try {
    const { content } = await callAI(userPrompt, TESTER_SYSTEM_PROMPT);
    
    // Parse test files from AI output
    const testFiles = parseTestFiles(content, projectPath);
    
    emitLog("tester", "info", `Generated ${testFiles.length} test files`);
    
    return {
      testFiles,
      count: testFiles.length
    };
  } catch (error: any) {
    emitLog("tester", "error", `Failed to generate tests: ${error.message}`);
    return {
      testFiles: [],
      count: 0
    };
  }
}

/**
 * Parse test files from AI output
 */
function parseTestFiles(content: string, projectPath: string): Array<{ path: string; content: string }> {
  const testFiles: Array<{ path: string; content: string }> = [];
  
  // Pattern 1: Filename: path
  const filenamePattern = /Filename:\s*([^\n]+)\n```(?:typescript|javascript|js|ts)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = filenamePattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2].trim();
    
    // Ensure it's in the right directory
    const fullPath = path.join(projectPath, filePath);
    
    testFiles.push({
      path: filePath,
      content: fileContent
    });
  }
  
  // Pattern 2: filepath: path
  if (testFiles.length === 0) {
    const filepathPattern = /```filepath:\s*([^\n]+)\n([\s\S]*?)```/g;
    
    while ((match = filepathPattern.exec(content)) !== null) {
      const filePath = match[1].trim();
      const fileContent = match[2].trim();
      
      testFiles.push({
        path: filePath,
        content: fileContent
      });
    }
  }
  
  return testFiles;
}

/**
 * Write test files to disk
 */
export async function writeTestFiles(
  projectPath: string,
  testFiles: Array<{ path: string; content: string }>
): Promise<void> {
  for (const testFile of testFiles) {
    const fullPath = path.join(projectPath, testFile.path);
    const dir = path.dirname(fullPath);
    
    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write test file
    await Bun.write(fullPath, testFile.content);
    emitLog("tester", "info", `Writing ${testFile.path}...`);
  }
}

/**
 * Run tests and collect results
 */
export async function runTests(projectPath: string): Promise<TestResult> {
  emitLog("tester", "info", "Running tests...");
  
  const startTime = Date.now();
  
  try {
    // Check if there are test files
    const testDir = path.join(projectPath, "src", "__tests__");
    if (!fs.existsSync(testDir)) {
      // Try to find any test files
      const hasTestFiles = await findTestFiles(projectPath);
      if (!hasTestFiles) {
        emitLog("tester", "warn", "No test files found");
        return {
          success: true,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          output: "No test files found"
        };
      }
    }
    
    // Check if test script exists in package.json
    const packageJsonPath = path.join(projectPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      emitLog("tester", "warn", "No package.json found");
      return {
        success: true,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        output: "No package.json found"
      };
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const hasTestScript = packageJson.scripts && packageJson.scripts.test;
    
    if (!hasTestScript) {
      emitLog("tester", "warn", "No test script in package.json");
      return {
        success: true,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        output: "No test script defined"
      };
    }
    
    // Run tests
    const { spawn } = require("child_process");
    
    return new Promise((resolve) => {
      const proc = spawn("npm", ["test"], {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, CI: "true" }
      });
      
      let stdout = "";
      let stderr = "";
      
      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
        emitLog("tester", "info", data.toString().trim());
      });
      
      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
        emitLog("tester", "warn", data.toString().trim());
      });
      
      proc.on("close", (code: number) => {
        const duration = Date.now() - startTime;
        
        // Parse test results from output
        const testOutput = stdout + stderr;
        const totalMatch = testOutput.match(/Tests:\s*(\d+)\s*total/i);
        const passedMatch = testOutput.match(/(\d+)\s*passed/i);
        const failedMatch = testOutput.match(/(\d+)\s*failed/i);
        
        const totalTests = totalMatch ? parseInt(totalMatch[1]) : 0;
        const passedTests = passedMatch ? parseInt(passedMatch[1]) : 0;
        const failedTests = failedMatch ? parseInt(failedMatch[1]) : 0;
        
        const result: TestResult = {
          success: code === 0,
          totalTests: totalTests || 0,
          passedTests,
          failedTests,
          output: testOutput.substring(0, 5000) // Limit output size
        };
        
        emitLog("tester", "info", 
          `Tests complete: ${passedTests}/${totalTests} passed (${duration}ms)`
        );
        
        resolve(result);
      });
      
      proc.on("error", (error: Error) => {
        resolve({
          success: false,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          output: error.message
        });
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        proc.kill("SIGTERM");
        resolve({
          success: false,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          output: "Test timeout (5 minutes)"
        });
      }, 300000);
    });
  } catch (error: any) {
    emitLog("tester", "error", `Test execution failed: ${error.message}`);
    return {
      success: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      output: error.message
    };
  }
}

/**
 * Find test files in project
 */
async function findTestFiles(projectPath: string): Promise<boolean> {
  const testPatterns = [
    "**/__tests__/**/*.ts",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**/*.js",
    "**/*.test.js",
    "**/*.spec.js"
  ];
  
  for (const pattern of testPatterns) {
    const testPath = path.join(projectPath, pattern.replace("**/", "").replace("/**/*", ""));
    if (fs.existsSync(testPath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Write test results to file
 */
export async function writeTestResults(
  projectPath: string,
  result: TestResult,
  iteration: number
): Promise<string> {
  const reportContent = `# Test Results - Iteration ${iteration}

## Summary
${result.success ? "✅ **ALL TESTS PASSED**" : "❌ **TESTS FAILED**"}

## Statistics
- Total Tests: ${result.totalTests}
- Passed: ${result.passedTests}
- Failed: ${result.failedTests}
- Success Rate: ${result.totalTests > 0 ? ((result.passedTests / result.totalTests) * 100).toFixed(1) : 0}%

## Output
\`\`\`
${result.output}
\`\`\`

## Status
${result.success ? "Ready for next phase" : "Requires fixes"}
`;

  const reportPath = path.join(projectPath, "test_results.md");
  await Bun.write(reportPath, reportContent);
  
  emitLog("tester", "info", `Test results written to ${reportPath}`);
  
  return reportPath;
}
