import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/contentpilot/article/[id] - Fetch full article by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const article = await prisma.article.findUnique({
      where: { id },
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
        },
      },
    });

    if (!article) {
      return Response.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return Response.json({
      article: {
        id: article.id,
        title: article.title,
        content: article.content,
        tldr: article.tldr,
        url: article.url,
        sourceUrl: article.sourceUrl,
        sourceName: article.sourceName,
        topics: article.topics,
        status: article.status,
        inNewsletterQueue: article.inNewsletterQueue,
        publishedAt: article.publishedAt,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        author: article.author,
        newsletters: article.newsletter_articles.map(na => na.newsletter),
      },
    });

  } catch (error: unknown) {
    console.error("Article fetch error:", error);
    return Response.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

// DELETE /api/contentpilot/article/[id] - Delete article
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      return Response.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Delete the article (newsletter_articles will be deleted due to cascade)
    await prisma.article.delete({
      where: { id },
    });

    return Response.json({
      success: true,
      message: "Article deleted successfully",
      deletedArticleId: id,
    });

  } catch (error: unknown) {
    console.error("Article deletion error:", error);
    return Response.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
} 