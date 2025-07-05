import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/contentpilot/memory - Fetch user memory/profile
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return Response.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    // Get user and their preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's article history and engagement patterns
    const articleStats = await prisma.article.groupBy({
      by: ['status'],
      where: { authorId: userId },
      _count: {
        id: true,
      },
    });

    const topicEngagement = await prisma.article.findMany({
      where: { authorId: userId },
      select: { topics: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Analyze topic preferences
    const topicFrequency: Record<string, number> = {};
    topicEngagement.forEach(article => {
      article.topics.forEach(topic => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      });
    });

    const sortedTopics = Object.entries(topicFrequency)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);

    const memory = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      preferences: user.preferences || {
        focusTopics: [],
        preferredSources: [],
        editorialStyle: null,
        notificationSettings: null,
      },
      analytics: {
        articleStats: articleStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
        topTopics: sortedTopics.slice(0, 10),
        totalArticles: topicEngagement.length,
        lastActivity: topicEngagement[0]?.createdAt || null,
      },
      insights: {
        mostEngagedTopic: sortedTopics[0]?.topic || null,
        topicDiversity: Object.keys(topicFrequency).length,
        averageArticlesPerWeek: calculateAverageArticlesPerWeek(topicEngagement),
      },
    };

    return Response.json(memory);

  } catch (error: unknown) {
    console.error("Memory retrieval error:", error);
    return Response.json(
      { error: "Failed to retrieve user memory" },
      { status: 500 }
    );
  }
}

function calculateAverageArticlesPerWeek(articles: Array<{ createdAt: Date | string }>): number {
  if (articles.length === 0) return 0;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentArticles = articles.filter(article => 
    new Date(article.createdAt) >= oneWeekAgo
  );

  return recentArticles.length;
} 