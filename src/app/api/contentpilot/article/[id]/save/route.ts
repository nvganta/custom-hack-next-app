import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

const SaveArticleSchema = z.object({
  userId: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().default("PUBLISHED"),
});

// POST /api/contentpilot/article/[id]/save - Save article to user's knowledge base
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userId, status } = SaveArticleSchema.parse(body);

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

    // Update article status and optionally assign to user
    const updateData: {
      status: string;
      updatedAt: Date;
      publishedAt?: Date;
      authorId?: string;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (status === "PUBLISHED") {
      updateData.publishedAt = new Date();
    }

    if (userId) {
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return Response.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      updateData.authorId = userId;
    }

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return Response.json({
      success: true,
      message: "Article saved successfully",
      article: {
        id: updatedArticle.id,
        title: updatedArticle.title,
        status: updatedArticle.status,
        publishedAt: updatedArticle.publishedAt,
        author: updatedArticle.author,
        updatedAt: updatedArticle.updatedAt,
      },
    });

  } catch (error: unknown) {
    console.error("Article save error:", error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to save article" },
      { status: 500 }
    );
  }
} 