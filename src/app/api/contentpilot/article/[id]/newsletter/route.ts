import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

const NewsletterQueueSchema = z.object({
  action: z.enum(["ADD", "REMOVE"]).default("ADD"),
  newsletterId: z.string().optional(),
  priority: z.number().min(0).max(100).optional().default(50),
});

// POST /api/contentpilot/article/[id]/newsletter - Queue article for newsletter
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const { action, newsletterId, priority } = NewsletterQueueSchema.parse(body);

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

    if (action === "ADD") {
      // Add to newsletter queue
      await prisma.article.update({
        where: { id },
        data: { inNewsletterQueue: true },
      });

      // If specific newsletter is provided, add to that newsletter
      if (newsletterId) {
        // Check if newsletter exists
        const newsletter = await prisma.newsletter.findUnique({
          where: { id: newsletterId },
        });

        if (!newsletter) {
          return Response.json(
            { error: "Newsletter not found" },
            { status: 404 }
          );
        }

        // Check if article is already in this newsletter
        const existingEntry = await prisma.newsletter_article.findUnique({
          where: {
            newsletterId_articleId: {
              newsletterId,
              articleId: id,
            },
          },
        });

        if (!existingEntry) {
          await prisma.newsletter_article.create({
            data: {
              newsletterId,
              articleId: id,
              order: priority,
            },
          });
        }
      }

      return Response.json({
        success: true,
        message: "Article added to newsletter queue",
        article: {
          id: article.id,
          title: article.title,
          inNewsletterQueue: true,
        },
        newsletterId: newsletterId || null,
      });

    } else if (action === "REMOVE") {
      // Remove from newsletter queue
      await prisma.article.update({
        where: { id },
        data: { inNewsletterQueue: false },
      });

      // If specific newsletter is provided, remove only from that newsletter
      if (newsletterId) {
        await prisma.newsletter_article.deleteMany({
          where: {
            newsletterId,
            articleId: id,
          },
        });
      } else {
        // Remove from all newsletters
        await prisma.newsletter_article.deleteMany({
          where: { articleId: id },
        });
      }

      return Response.json({
        success: true,
        message: "Article removed from newsletter queue",
        article: {
          id: article.id,
          title: article.title,
          inNewsletterQueue: false,
        },
        newsletterId: newsletterId || null,
      });
    }

  } catch (error: unknown) {
    console.error("Newsletter queue error:", error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to update newsletter queue" },
      { status: 500 }
    );
  }
} 