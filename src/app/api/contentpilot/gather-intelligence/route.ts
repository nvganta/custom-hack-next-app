import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import FirecrawlApp from '@mendable/firecrawl-js';
import Groq from "groq-sdk";

const prisma = new PrismaClient();
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface ScrapedContent {
  content: string;
  sourceName: string;
  sourceUrl: string;
}

interface GeneratedArticle {
  title: string;
  tldr: string;
  content: string;
}

export async function POST() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const briefing = await prisma.intelligence_briefing.upsert({
      where: { date: today },
      update: { status: "PROCESSING" },
      create: { date: today, status: "PROCESSING" },
    });

    const settings = await prisma.setting.findUnique({ where: { key: "articlesPerCycle" }});
    const articlesToGenerate = parseInt(settings?.value ?? '10', 10);

    const sources = await prisma.content_source.findMany({ where: { isActive: true } });
    if (sources.length === 0) {
      throw new Error("No active content sources found.");
    }
    
    const topics = await prisma.topic.findMany();
    const topicKeywords = topics.map(t => t.name);

    const allScrapedData: ScrapedContent[] = [];
    if (sources.length > 0) {
      for (const source of sources) {
        console.log(`Scraping source: ${source.name}`);
        try {
          const scrapeResult = await firecrawl.scrapeUrl(source.url);

          console.log("SCRAPE RESULT:", JSON.stringify(scrapeResult, null, 2));

          // Handle different response structures
          if (scrapeResult && typeof scrapeResult === 'object') {
            let content: string | null = null;
            
            // Check if scraping was successful
            if ('success' in scrapeResult && scrapeResult.success) {
              // The content is in the 'markdown' property
              if ('markdown' in scrapeResult && typeof scrapeResult.markdown === 'string') {
                content = scrapeResult.markdown;
              }
            } else if ('error' in scrapeResult) {
              console.error(`Scraping failed for ${source.name}:`, scrapeResult.error);
            }

            if (content && content.trim()) {
              // Limit content length to prevent API rate limits
              const maxContentLength = 1000;
              const trimmedContent = content.length > maxContentLength 
                ? content.substring(0, maxContentLength) + '...'
                : content;

              allScrapedData.push({
                content: trimmedContent,
                sourceName: source.name,
                sourceUrl: source.url
              });
            } else {
              console.warn(`No content found for ${source.name}`);
            }
          } else {
            console.error(`Invalid response structure for ${source.name}:`, scrapeResult);
          }
        } catch(e) {
          console.error(`Failed to scrape ${source.name}`, e);
        }
      }
    }

    if (allScrapedData.length === 0) {
        throw new Error("Could not scrape any content from the sources.");
    }
    
    // Combine content with length limits to prevent API rate limits
    const combinedContent = allScrapedData.map(d => `Source: ${d.sourceName}\n\n${d.content}`).join('\n\n---\n\n');
    
    // Limit total content length for Groq API
    const maxTotalLength = 4000;
    const finalContent = combinedContent.length > maxTotalLength 
      ? combinedContent.substring(0, maxTotalLength) + '\n\n[Content truncated due to length limits]'
      : combinedContent;

    console.log("Generating articles with Groq AI...");
    console.log("Content length:", finalContent.length);
    
    const chatCompletion = await groq.chat.completions.create({
        messages: [
            {
                role: "system",
                content: `You are a world-class tech journalist. Your task is to analyze the provided text from various sources and generate a set of ${articlesToGenerate} distinct, insightful, and well-written articles.
                
                Focus on the topics of: ${topicKeywords.join(', ')}.
                
                For each article, provide:
                1. A compelling title (10-15 words)
                2. A short TL;DR summary (2-3 sentences max)
                3. Full article content (4-6 detailed paragraphs, minimum 300 words each article)
                
                The article content should be comprehensive, well-structured, and include:
                - An engaging introduction
                - Key insights and analysis
                - Relevant examples or data points
                - Future implications or conclusions
                
                Respond with a valid JSON object in the following structure: { "articles": [{ "title": "...", "tldr": "...", "content": "..." }] }.
                Do not include any other text or explanations in your response. Just the JSON.`,
            },
            {
                role: "user",
                content: finalContent,
            },
        ],
        model: "llama3-70b-8192",
        temperature: 0.7,
        max_tokens: 6000,
        response_format: { type: "json_object" },
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    if (!responseContent) {
        throw new Error("Groq AI did not return any content.");
    }

    const parsedResponse = JSON.parse(responseContent);
    const generatedArticles: GeneratedArticle[] = parsedResponse.articles || [];

    for (const article of generatedArticles) {
        // Find the source of the content, just for reference
        const matchingSource = allScrapedData.find(d => 
          article.content.includes(d.content.substring(0, 100)) || 
          article.title.toLowerCase().includes(d.sourceName.toLowerCase())
        );

        await prisma.article.create({
            data: {
                title: article.title,
                tldr: article.tldr,
                content: article.content,
                status: "DRAFT",
                sourceName: matchingSource?.sourceName || "AI-Generated",
                sourceUrl: matchingSource?.sourceUrl || undefined,
                topics: topicKeywords.filter(t => 
                  article.title.toLowerCase().includes(t.toLowerCase()) || 
                  article.content.toLowerCase().includes(t.toLowerCase())
                )
            }
        });
    }

    await prisma.intelligence_briefing.update({
      where: { id: briefing.id },
      data: {
        status: "READY",
        articlesGenerated: generatedArticles.length,
        topicsGathered: topicKeywords,
      },
    });

    // Check if email notifications are enabled and send summary
    try {
      const emailSettings = await Promise.all([
        prisma.setting.findUnique({ where: { key: "enableEmailNotifications" } }),
        prisma.setting.findUnique({ where: { key: "notificationEmail" } }),
      ]);

      const enableNotifications = emailSettings[0]?.value === 'true';
      const notificationEmail = emailSettings[1]?.value;

      if (enableNotifications && notificationEmail) {
        // Get the created articles for the summary
        const createdArticles = await prisma.article.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
            },
          },
          orderBy: { createdAt: 'desc' },
          take: generatedArticles.length,
        });

        // Prepare summary data
        const summary = {
          totalArticles: generatedArticles.length,
          articles: createdArticles.map(article => ({
            id: article.id,
            title: article.title,
            content: article.content || article.tldr,
            topics: article.topics,
            status: article.status,
            createdAt: article.createdAt.toISOString(),
          })),
          topics: topicKeywords,
          date: new Date().toISOString(),
        };

        // Send intelligence summary email
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');
        
        const emailResponse = await fetch(`${baseUrl}/api/contentpilot/intelligence-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary,
            userEmail: notificationEmail,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Failed to send intelligence summary email:', await emailResponse.text());
        } else {
          console.log('Intelligence summary email sent successfully');
        }
      }
    } catch (emailError) {
      console.error('Error sending intelligence summary email:', emailError);
      // Don't fail the whole process if email fails
    }

    return NextResponse.json({ 
      success: true, 
      articlesGenerated: generatedArticles.length,
      sourcesProcessed: allScrapedData.length,
      topicsUsed: topicKeywords.length
    });
  } catch (error: unknown) {
    console.error("Gather intelligence error:", error);
    return NextResponse.json(
      { 
        error: "Failed to gather intelligence",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 
