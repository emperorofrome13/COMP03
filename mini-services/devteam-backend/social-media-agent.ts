// Social Media Agent - Creates social media content for project promotion
import { callAI, emitLog } from "./index";
import path from "path";

export interface SocialMediaContent {
  twitter: SocialPost[];
  linkedin: SocialPost[];
  reddit: SocialPost;
  devto: DevToPost;
  hashtags: string[];
}

export interface SocialPost {
  content: string;
  characterCount: number;
  thread?: string[];
  images?: string[];
}

export interface DevToPost {
  title: string;
  description: string;
  tags: string[];
  content: string;
}

const SOCIAL_MEDIA_SYSTEM_PROMPT = `You are the Social Media Agent for DevTeam.

Your role is to create engaging social media content to promote software projects.

**Platforms:**
1. Twitter/X - Short, punchy, hashtag-heavy (280 chars)
2. LinkedIn - Professional, detailed, business-focused
3. Reddit - Community-oriented, authentic, value-focused
4. Dev.to - Technical, tutorial-style, developer-focused

**Guidelines:**
- Be authentic, not salesy
- Focus on value provided
- Use appropriate tone per platform
- Include relevant hashtags
- Add emojis sparingly but effectively
- Include call-to-action

**For Twitter:**
- Create 3-5 tweet options
- Consider thread format for longer content
- Max 280 characters per tweet

**For LinkedIn:**
- Professional tone
- Longer form (up to 1000 chars)
- Business benefits focus

**For Reddit:**
- Authentic, community-focused
- Share learnings/challenges
- Ask for feedback

**For Dev.to:**
- Technical deep-dive
- Include code snippets mention
- Tutorial format

Output in structured markdown format.`;

export async function generateSocialMediaContent(
  projectName: string,
  projectDescription: string,
  techStack: string,
  keyFeatures: string[],
  marketingCopy: string
): Promise<SocialMediaContent> {
  emitLog("social", "info", `Generating social media content for ${projectName}...`);
  
  const userPrompt = `Create social media content to promote this software project:

**Project Name:** ${projectName}

**Description:** ${projectDescription}

**Tech Stack:** ${techStack}

**Key Features:**
${keyFeatures.map(f => `- ${f}`).join("\n")}

**Marketing Copy:**
${marketingCopy}

Generate content for:
1. Twitter/X (3-5 tweet options, under 280 chars each)
2. LinkedIn (2 post options, professional tone)
3. Reddit (1 post for r/programming or r/webdev)
4. Dev.to (1 article outline with title, description, tags)
5. Relevant hashtags (10-15)

Make each platform's content unique and appropriate for that audience.`;

  try {
    const { content } = await callAI(userPrompt, SOCIAL_MEDIA_SYSTEM_PROMPT);
    
    // Parse the response
    const socialContent = parseSocialContent(content);
    
    emitLog("social", "info", "Social media content generated successfully");
    
    return socialContent;
  } catch (error: any) {
    emitLog("social", "error", `Failed to generate social media content: ${error.message}`);
    
    return generateFallbackSocialContent(projectName, techStack);
  }
}

function parseSocialContent(content: string): SocialMediaContent {
  const extractSection = (heading: string): string => {
    const pattern = new RegExp(`##?\\s*${heading}[\\s\\S]*?(?=##?\\s*|$)`, "i");
    const match = content.match(pattern);
    return match ? match[0].replace(/##?\\s*/g, "").replace(heading, "").trim() : "";
  };
  
  const extractTweets = (): SocialPost[] => {
    const section = extractSection("Twitter") || extractSection("Tweet");
    const tweets = section.match(/(?:Tweet\\s*\\d*:?|[-*])\\s*([\\s\\S]{10,280})(?=(?:Tweet\\s*\\d*:|[-*]|##))/g) || [];
    return tweets.map(t => {
      const text = t.replace(/(?:Tweet\\s*\\d*:?|[-*])\\s*/, "").trim();
      return {
        content: text,
        characterCount: text.length
      };
    });
  };
  
  const extractHashtags = (): string[] => {
    const section = extractSection("Hashtags");
    const tags = section.match(/#\\w+/g) || [];
    return [...new Set(tags)]; // Remove duplicates
  };
  
  return {
    twitter: extractTweets().length > 0 ? extractTweets() : generateTweets(content),
    linkedin: generateLinkedInPosts(content),
    reddit: generateRedditPost(content),
    devto: generateDevToPost(content),
    hashtags: extractHashtags()
  };
}

function generateTweets(content: string): SocialPost[] {
  // Fallback tweet generation
  return [
    {
      content: "🚀 Just built something amazing! Check out this new project that's going to change how you work. #coding #webdev #javascript",
      characterCount: 140
    },
    {
      content: "✨ New project alert! Built with modern tech stack and ready for production. What do you think? #100DaysOfCode #buildinpublic",
      characterCount: 135
    },
    {
      content: "💡 Sometimes the best solutions come from the simplest ideas. Here's what I've been working on... #developer #programming",
      characterCount: 130
    }
  ];
}

function generateLinkedInPosts(content: string): SocialPost[] {
  return [
    {
      content: "Excited to share a new project I've been working on! This solution addresses real-world challenges and leverages modern technology to deliver exceptional results. Would love to hear your feedback! #innovation #softwaredevelopment #technology",
      characterCount: 280
    }
  ];
}

function generateRedditPost(content: string): SocialPost {
  return {
    content: `Hey r/programming! I wanted to share a project I've been working on.

**What it is:** A solution for [problem]

**Tech stack:** Modern web technologies

**What I learned:** [Key learnings]

Would love to get your feedback and thoughts! What would you do differently?

[Link to project]`,
    characterCount: 300
  };
}

function generateDevToPost(content: string): DevToPost {
  return {
    title: "Building [Project]: Lessons Learned and Technical Deep Dive",
    description: "A technical exploration of building a modern web application",
    tags: ["webdev", "javascript", "tutorial", "beginners"],
    content: "# Building [Project]\n\nIn this post, I'll walk through the technical decisions, challenges, and solutions..."
  };
}

function generateFallbackSocialContent(projectName: string, techStack: string): SocialMediaContent {
  return {
    twitter: [
      {
        content: `🚀 Just shipped ${projectName}! Built with ${techStack}. Check it out! #coding #webdev #buildinpublic`,
        characterCount: 95
      }
    ],
    linkedin: [
      {
        content: `Pleased to announce the completion of ${projectName}, a new software solution built with ${techStack}. This project demonstrates the power of modern development practices. #softwaredevelopment #innovation`,
        characterCount: 200
      }
    ],
    reddit: {
      content: `Built ${projectName} with ${techStack}. Happy to answer questions about the development process!`,
      characterCount: 100
    },
    devto: {
      title: `How I Built ${projectName} with ${techStack}`,
      description: "A technical deep dive into the development process",
      tags: ["webdev", techStack.toLowerCase().split(" ")[0] || "javascript", "tutorial"],
      content: "# Introduction\n\nIn this article, I'll share how I built..."
    },
    hashtags: ["#coding", "#webdev", "#javascript", "#programming", "#buildinpublic", "#100DaysOfCode", "#developer", "#tech", "#software", "#opensource"]
  };
}

/**
 * Write social media content to file
 */
export async function writeSocialMediaReport(
  projectPath: string,
  projectName: string,
  content: SocialMediaContent
): Promise<string> {
  const reportContent = `# Social Media Content: ${projectName}

## Twitter/X 🐦

${content.twitter.map((tweet, i) => `**Tweet ${i + 1}:** (${tweet.characterCount} chars)
${tweet.content}
`).join("\n")}

## LinkedIn 💼

${content.linkedin.map((post, i) => `**Post ${i + 1}:** (${post.characterCount} chars)
${post.content}
`).join("\n")}

## Reddit 📱

**Post for r/programming or r/webdev:**

${content.reddit.content}

## Dev.to 📝

**Title:** ${content.devto.title}

**Description:** ${content.devto.description}

**Tags:** ${content.devto.tags.join(", ")}

**Content Outline:**
${content.devto.content}

## Hashtags #️⃣

${content.hashtags.join(" ")}

---
*Generated by DevTeam Social Media Agent*
`;

  const reportPath = path.join(projectPath, "SOCIAL_MEDIA.md");
  await Bun.write(reportPath, reportContent);
  
  emitLog("social", "info", `Social media report written to ${reportPath}`);
  
  return reportPath;
}
