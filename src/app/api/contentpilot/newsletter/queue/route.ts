import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/contentpilot/newsletter/queue - List articles queued for newsletter
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const newsletterId = url.searchParams.get('newsletterId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const whereClause = {
      inNewsletterQueue: true,
    };

    // Get articles in newsletter queue
    const articles = await prisma.article.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        newsletter_articles: {
          include: {
            newsletter: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // If specific newsletter ID is provided, filter articles in that newsletter
    let filteredArticles = articles;
    if (newsletterId) {
      filteredArticles = articles.filter(article => 
        article.newsletter_articles.some(na => na.newsletter.id === newsletterId)
      );
    }

    // Get total count for pagination
    const totalCount = await prisma.article.count({
      where: whereClause,
    });

    // Get newsletter summary if specific newsletter is requested
    let newsletterInfo = null;
    if (newsletterId) {
      newsletterInfo = await prisma.newsletter.findUnique({
        where: { id: newsletterId },
        select: {
          id: true,
          title: true,
          subject: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
        },
      });
    }

    const response = {
      queue: {
        articles: filteredArticles.map(article => ({
          id: article.id,
          title: article.title,
          tldr: article.tldr,
          topics: article.topics,
          sourceName: article.sourceName,
          status: article.status,
          createdAt: article.createdAt,
          author: article.author,
          newsletters: article.newsletter_articles.map(na => ({
            id: na.newsletter.id,
            title: na.newsletter.title,
            status: na.newsletter.status,
            order: na.order,
          })),
        })),
        totalCount: newsletterId ? filteredArticles.length : totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      newsletter: newsletterInfo,
      summary: {
        totalQueued: totalCount,
        inSpecificNewsletter: newsletterId ? filteredArticles.length : null,
        topicDistribution: getTopicDistribution(articles),
      },
    };

    return Response.json(response);

  } catch (error: unknown) {
    console.error("Newsletter queue retrieval error:", error);
    return Response.json(
      { error: "Failed to retrieve newsletter queue" },
      { status: 500 }
    );
  }
}

function getTopicDistribution(articles: Array<{ topics: string[] }>) {
  const topicCounts: Record<string, number> = {};
  
  articles.forEach(article => {
    article.topics.forEach((topic: string) => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
  });

  return Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
} 
