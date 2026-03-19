// Marketing Agent - Creates marketing materials for completed projects
import { callAI, emitLog } from "./index";
import path from "path";

export interface MarketingMaterials {
  elevatorPitch: string;
  valueProposition: string;
  targetAudience: string;
  keyFeatures: string[];
  competitiveAdvantages: string[];
  pricingStrategy?: string;
  marketingCopy: string;
  landingPageHeadline: string;
  callToAction: string;
}

const MARKETING_SYSTEM_PROMPT = `You are the Marketing Agent for DevTeam.

Your role is to create compelling marketing materials for software projects after they are completed.

**Focus Areas:**
1. Clear value proposition
2. Target audience identification
3. Key features and benefits
4. Competitive positioning
5. Sales-ready copy

**Output Style:**
- Professional but accessible
- Benefit-focused (not feature-focused)
- Action-oriented
- SEO-friendly

**For SaaS Products:**
- Include pricing strategy suggestions
- Free trial recommendations
- Conversion optimization tips

Output in structured markdown format.`;

export async function generateMarketingMaterials(
  projectName: string,
  projectDescription: string,
  techStack: string,
  features: string[]
): Promise<MarketingMaterials> {
  emitLog("marketing", "info", `Generating marketing materials for ${projectName}...`);
  
  const userPrompt = `Create comprehensive marketing materials for this software project:

**Project Name:** ${projectName}

**Description:** ${projectDescription}

**Tech Stack:** ${techStack}

**Features:**
${features.map(f => `- ${f}`).join("\n")}

Generate:
1. Elevator pitch (1-2 sentences)
2. Value proposition (what problem does it solve)
3. Target audience (who should use this)
4. Key features (top 5 benefits, not just features)
5. Competitive advantages (what makes it unique)
6. Pricing strategy (if SaaS)
7. Marketing copy (paragraph for website)
8. Landing page headline (catchy, benefit-driven)
9. Call to action (what should users do next)`;

  try {
    const { content } = await callAI(userPrompt, MARKETING_SYSTEM_PROMPT);
    
    // Parse the response into structured format
    const materials = parseMarketingContent(content, projectName);
    
    emitLog("marketing", "info", "Marketing materials generated successfully");
    
    return materials;
  } catch (error: any) {
    emitLog("marketing", "error", `Failed to generate marketing materials: ${error.message}`);
    
    // Fallback
    return generateFallbackMarketing(projectName, projectDescription);
  }
}

function parseMarketingContent(content: string, projectName: string): MarketingMaterials {
  // Extract sections from markdown content
  const extractSection = (heading: string): string => {
    const pattern = new RegExp(`##?\\s*${heading}[\\s\\S]*?(?=##?\\s*|$)`, "i");
    const match = content.match(pattern);
    return match ? match[0].replace(/##?\\s*/g, "").replace(heading, "").trim() : "";
  };
  
  const extractList = (heading: string): string[] => {
    const section = extractSection(heading);
    const items = section.match(/[-*]\\s*(.+)/g) || [];
    return items.map(item => item.replace(/[-*]\\s*/, "").trim());
  };
  
  return {
    elevatorPitch: extractSection("Elevator Pitch") || extractSection("Pitch") || `Build ${projectName} - a powerful solution for modern businesses.`,
    valueProposition: extractSection("Value Proposition") || extractSection("Problem Solved") || "Solves critical business challenges with elegant technology.",
    targetAudience: extractSection("Target Audience") || extractSection("Who Should Use This") || "Developers and businesses looking for efficient solutions.",
    keyFeatures: extractList("Key Features") || extractList("Features") || ["Feature 1", "Feature 2", "Feature 3"],
    competitiveAdvantages: extractList("Competitive Advantages") || extractList("Advantages") || ["Easy to use", "Fast implementation", "Cost-effective"],
    pricingStrategy: extractSection("Pricing Strategy") || extractSection("Pricing") || undefined,
    marketingCopy: extractSection("Marketing Copy") || extractSection("Website Copy") || `Discover ${projectName}, the solution you've been waiting for.`,
    landingPageHeadline: extractSection("Landing Page Headline") || extractSection("Headline") || `Transform Your Workflow with ${projectName}`,
    callToAction: extractSection("Call to Action") || extractSection("CTA") || "Get Started Today"
  };
}

function generateFallbackMarketing(projectName: string, projectDescription: string): MarketingMaterials {
  return {
    elevatorPitch: `Introducing ${projectName} - ${projectDescription.substring(0, 100)}`,
    valueProposition: "Streamline your workflow with this powerful, easy-to-use solution.",
    targetAudience: "Developers, startups, and businesses seeking efficient tools",
    keyFeatures: [
      "Modern, responsive design",
      "Easy to customize and extend",
      "Production-ready code",
      "Well-documented",
      "Fast performance"
    ],
    competitiveAdvantages: [
      "Built with latest technologies",
      "Clean, maintainable codebase",
      "Ready for deployment",
      "Cost-effective solution"
    ],
    pricingStrategy: "Freemium model: Free tier for individuals, $9-29/month for teams",
    marketingCopy: `${projectName} is the solution you've been waiting for. Built with cutting-edge technology and designed for real-world use, it helps you achieve more in less time. Join hundreds of satisfied users who have transformed their workflow.`,
    landingPageHeadline: `Build Better with ${projectName}`,
    callToAction: "Start Your Free Trial"
  };
}

/**
 * Write marketing materials to file
 */
export async function writeMarketingReport(
  projectPath: string,
  projectName: string,
  materials: MarketingMaterials
): Promise<string> {
  const reportContent = `# Marketing Materials: ${projectName}

## 🚀 Elevator Pitch
${materials.elevatorPitch}

## 💎 Value Proposition
${materials.valueProposition}

## 👥 Target Audience
${materials.targetAudience}

## ✨ Key Features
${materials.keyFeatures.map(f => `- ${f}`).join("\n")}

## 🏆 Competitive Advantages
${materials.competitiveAdvantages.map(a => `- ${a}`).join("\n")}

${materials.pricingStrategy ? `## 💰 Pricing Strategy
${materials.pricingStrategy}
` : ""}

## 📝 Marketing Copy
${materials.marketingCopy}

## 🎯 Landing Page Headline
${materials.landingPageHeadline}

## 📣 Call to Action
${materials.callToAction}

---
*Generated by DevTeam Marketing Agent*
`;

  const reportPath = path.join(projectPath, "MARKETING.md");
  await Bun.write(reportPath, reportContent);
  
  emitLog("marketing", "info", `Marketing report written to ${reportPath}`);
  
  return reportPath;
}
