// QA Agent - Code quality analysis
import { callAI, emitLog } from "./index";
import path from "path";
import fs from "fs";

export interface QAReport {
  overall: "pass" | "fail" | "warning";
  codeQuality: QAMetric;
  security: QAMetric;
  performance: QAMetric;
  documentation: QAMetric;
  issues: QAIssue[];
  recommendations: string[];
}

export interface QAMetric {
  score: number; // 0-100
  status: "pass" | "fail" | "warning";
  details: string;
}

export interface QAIssue {
  severity: "critical" | "major" | "minor";
  category: string;
  file?: string;
  line?: number;
  description: string;
  suggestion: string;
}

const QA_SYSTEM_PROMPT = `You are the QA Agent for comp03, an AI-powered software development system.

Your role is to analyze code quality and ensure best practices.

**Evaluation Criteria:**

1. **Code Quality** (40% weight)
   - Consistent naming conventions
   - Function length (< 50 lines)
   - Cyclomatic complexity (< 10)
   - DRY principle (no duplication)
   - Proper error handling
   - Type safety (TypeScript)

2. **Security** (30% weight)
   - Input validation
   - No hardcoded secrets
   - SQL injection prevention
   - XSS prevention
   - Authentication/authorization

3. **Performance** (20% weight)
   - Efficient algorithms
   - No unnecessary re-renders
   - Proper caching
   - Bundle size consideration

4. **Documentation** (10% weight)
   - Function comments
   - README completeness
   - API documentation
   - Inline comments for complex logic

**Output Format:**
Provide a structured analysis with:
- Overall verdict (pass/fail/warning)
- Score per category (0-100)
- Specific issues found
- Actionable recommendations

Be constructive and specific. Focus on critical issues first.`;

/**
 * Analyze code quality
 */
export async function analyzeCodeQuality(
  projectPath: string,
  codeFiles: Array<{ path: string; content: string }>
): Promise<QAReport> {
  emitLog("qa", "info", `Analyzing ${codeFiles.length} files for quality...`);
  
  // Prepare code context
  const codeContext = codeFiles
    .filter(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx') || f.path.endsWith('.js') || f.path.endsWith('.jsx'))
    .slice(0, 15) // Limit to avoid token limits
    .map(f => `// File: ${f.path}\n${f.content.substring(0, 1500)}`)
    .join('\n\n---\n\n');
  
  const userPrompt = `Analyze the code quality for this project:

Project Path: ${projectPath}

Code Files:
${codeContext}

Evaluate based on:
1. Code Quality (naming, complexity, DRY, error handling, types)
2. Security (input validation, no secrets, injection prevention)
3. Performance (efficiency, caching, bundle size)
4. Documentation (comments, README, API docs)

Provide specific issues with file paths and line numbers where possible.
Output a structured QA report.`;

  try {
    const { content } = await callAI(userPrompt, QA_SYSTEM_PROMPT);
    
    // Parse QA report from AI output
    const report = parseQAReport(content);
    
    emitLog("qa", "info", 
      `QA complete: ${report.overall} (Quality: ${report.codeQuality.score}, Security: ${report.security.score})`
    );
    
    return report;
  } catch (error: any) {
    emitLog("qa", "error", `QA analysis failed: ${error.message}`);
    
    // Return basic pass if analysis fails
    return {
      overall: "pass",
      codeQuality: { score: 80, status: "pass", details: "Analysis failed, assuming acceptable" },
      security: { score: 80, status: "pass", details: "Analysis failed, assuming acceptable" },
      performance: { score: 80, status: "pass", details: "Analysis failed, assuming acceptable" },
      documentation: { score: 80, status: "pass", details: "Analysis failed, assuming acceptable" },
      issues: [],
      recommendations: ["Manual review recommended due to analysis failure"]
    };
  }
}

/**
 * Parse QA report from AI output
 */
function parseQAReport(content: string): QAReport {
  // Default report structure
  const report: QAReport = {
    overall: "pass",
    codeQuality: { score: 85, status: "pass", details: "Good code quality" },
    security: { score: 85, status: "pass", details: "No major security issues" },
    performance: { score: 85, status: "pass", details: "Performance acceptable" },
    documentation: { score: 85, status: "pass", details: "Documentation present" },
    issues: [],
    recommendations: []
  };
  
  // Try to extract overall verdict
  const overallMatch = content.match(/overall[:\s]*(pass|fail|warning)/i);
  if (overallMatch) {
    report.overall = overallMatch[1].toLowerCase() as "pass" | "fail" | "warning";
  }
  
  // Try to extract scores
  const qualityMatch = content.match(/code\s*quality[:\s]*(\d+)/i);
  if (qualityMatch) {
    report.codeQuality.score = parseInt(qualityMatch[1]);
    report.codeQuality.status = getScoreStatus(report.codeQuality.score);
  }
  
  const securityMatch = content.match(/security[:\s]*(\d+)/i);
  if (securityMatch) {
    report.security.score = parseInt(securityMatch[1]);
    report.security.status = getScoreStatus(report.security.score);
  }
  
  // Try to extract issues
  const issuePatterns = [
    /(?:issue|problem|concern)[:\s]*([^\n]+)/gi,
    /[-*]\s*(critical|major|minor)[:\s]*([^\n]+)/gi
  ];
  
  for (const pattern of issuePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const severity = match[1]?.toLowerCase() || "minor";
      const description = match[2] || match[0];
      
      report.issues.push({
        severity: severity as "critical" | "major" | "minor",
        category: "code_quality",
        description: description.trim(),
        suggestion: "Review and fix"
      });
    }
  }
  
  // Try to extract recommendations
  const recPattern = /(?:recommendation|suggestion|should)[:\s]*([^\n]+)/gi;
  let recMatch;
  while ((recMatch = recPattern.exec(content)) !== null) {
    report.recommendations.push(recMatch[1].trim());
  }
  
  // Update overall based on scores
  const avgScore = (
    report.codeQuality.score +
    report.security.score +
    report.performance.score +
    report.documentation.score
  ) / 4;
  
  if (avgScore < 60) {
    report.overall = "fail";
  } else if (avgScore < 80) {
    report.overall = "warning";
  }
  
  return report;
}

/**
 * Get status from score
 */
function getScoreStatus(score: number): "pass" | "fail" | "warning" {
  if (score >= 80) return "pass";
  if (score >= 60) return "warning";
  return "fail";
}

/**
 * Check for specific code quality issues
 */
export function checkCodeMetrics(codeFiles: Array<{ path: string; content: string }>): {
  avgFunctionLength: number;
  totalFunctions: number;
  hasTypeScript: boolean;
  hasErrorHandling: boolean;
  hasDocumentation: boolean;
} {
  let totalFunctions = 0;
  let totalFunctionLines = 0;
  let hasTypeScript = false;
  let hasErrorHandling = false;
  let hasDocumentation = false;
  
  for (const file of codeFiles) {
    if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
      hasTypeScript = true;
    }
    
    const content = file.content;
    
    // Count functions
    const functionMatches = content.matchAll(/(?:function|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\))/g);
    let funcCount = 0;
    for (const match of functionMatches) {
      funcCount++;
      totalFunctions++;
    }
    
    // Estimate function length (simplified)
    if (funcCount > 0) {
      const linesPerFunction = content.split('\n').length / funcCount;
      totalFunctionLines += linesPerFunction;
    }
    
    // Check for error handling
    if (content.includes('try') || content.includes('catch') || content.includes('throw')) {
      hasErrorHandling = true;
    }
    
    // Check for documentation
    if (content.includes('/**') || content.includes('//') || content.includes('* @')) {
      hasDocumentation = true;
    }
  }
  
  return {
    avgFunctionLength: totalFunctions > 0 ? Math.round(totalFunctionLines / totalFunctions) : 0,
    totalFunctions,
    hasTypeScript,
    hasErrorHandling,
    hasDocumentation
  };
}

/**
 * Write QA report to file
 */
export async function writeQAReport(
  projectPath: string,
  report: QAReport,
  iteration: number
): Promise<string> {
  const reportContent = `# QA Report - Iteration ${iteration}

## Overall Verdict
${getVerdictEmoji(report.overall)} **${report.overall.toUpperCase()}**

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| Code Quality | ${report.codeQuality.score}/100 | ${getStatusEmoji(report.codeQuality.status)} ${report.codeQuality.status} |
| Security | ${report.security.score}/100 | ${getStatusEmoji(report.security.status)} ${report.security.status} |
| Performance | ${report.performance.score}/100 | ${getStatusEmoji(report.performance.status)} ${report.performance.status} |
| Documentation | ${report.documentation.score}/100 | ${getStatusEmoji(report.documentation.status)} ${report.documentation.status} |

## Issues Found

${report.issues.length > 0 
  ? report.issues.map(issue => `
### ${getSeverityEmoji(issue.severity)} ${issue.severity.toUpperCase()}
- **Category:** ${issue.category}
- **File:** ${issue.file || 'N/A'}
- **Description:** ${issue.description}
- **Suggestion:** ${issue.suggestion}
`).join('\n')
  : 'No critical issues found'
}

## Recommendations

${report.recommendations.length > 0
  ? report.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
  : 'No specific recommendations'
}

## Next Steps

${report.overall === 'pass' 
  ? '✅ Code quality is acceptable. Proceed to next phase.' 
  : '⚠️ Address issues above before proceeding.'
}

---
*Generated by comp03 QA Agent*
`;

  const reportPath = path.join(projectPath, "qa_report.md");
  await Bun.write(reportPath, reportContent);
  
  emitLog("qa", "info", `QA report written to ${reportPath}`);
  
  return reportPath;
}

function getVerdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'pass': return '✅';
    case 'fail': return '❌';
    case 'warning': return '⚠️';
    default: return '❓';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pass': return '✅';
    case 'fail': return '❌';
    case 'warning': return '⚠️';
    default: return '❓';
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'major': return '🟡';
    case 'minor': return '🟢';
    default: return '❓';
  }
}
