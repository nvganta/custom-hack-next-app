import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    
    // Get target date (today by default)
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Get the intelligence briefing for the target date
    const briefing = await prisma.intelligence_briefing.findUnique({
      where: { date: targetDate },
    });

    if (!briefing) {
      return Response.json({
        date: targetDate.toISOString().split('T')[0],
        status: "NO_BRIEFING",
        message: "No intelligence briefing available for this date",
        topics: [],
        articles: [],
      });
    }

    // Get articles created for this briefing (articles created on the same date)
    const articles = await prisma.article.findMany({
      where: {
        createdAt: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
        status: { in: ["DRAFT", "PUBLISHED"] },
      },
      select: {
        id: true,
        title: true,
        tldr: true,
        content: true,
        topics: true,
        sourceName: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        inNewsletterQueue: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group articles by topic for better organization
    const topicGroups = articles.reduce((acc, article) => {
      article.topics.forEach(topic => {
        if (!acc[topic]) {
          acc[topic] = [];
        }
        acc[topic].push(article);
      });
      return acc;
    }, {} as Record<string, typeof articles>);

    // Generate summary statistics
    const summary = {
      totalArticles: articles.length,
      uniqueTopics: Object.keys(topicGroups).length,
      sourcesUsed: [...new Set(articles.map(a => a.sourceName).filter(Boolean))].length,
      articlesInQueue: articles.filter(a => a.inNewsletterQueue).length,
    };

    const brief = {
      date: targetDate.toISOString().split('T')[0],
      status: briefing.status,
      briefingId: briefing.id,
      summary,
      topicsGathered: briefing.topicsGathered,
      articles: articles.map(article => ({
        id: article.id,
        title: article.title,
        tldr: article.tldr,
        content: article.content,
        topics: article.topics,
        source: {
          name: article.sourceName,
          url: article.sourceUrl,
        },
        status: article.status,
        inNewsletterQueue: article.inNewsletterQueue,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        draftLink: `/api/contentpilot/article/${article.id}`,
      })),
      topicGroups: Object.entries(topicGroups).map(([topic, topicArticles]) => ({
        topic,
        articleCount: topicArticles.length,
        articles: topicArticles.map(a => ({
          id: a.id,
          title: a.title,
          tldr: a.tldr,
        })),
      })),
      processingInfo: briefing.processingLog ? JSON.parse(briefing.processingLog) : null,
      lastUpdated: briefing.updatedAt,
    };

    return Response.json(brief);

  } catch (error: unknown) {
    console.error("Brief retrieval error:", error);
    return Response.json(
      { 
        error: "Failed to retrieve brief",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 
