import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { z } from "zod";
import { generateNewsletterHTML, generateNewsletterText } from "../../../../../lib/contentpilot/email-templates";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const SendNewsletterSchema = z.object({
  newsletterId: z.string().optional(),
  title: z.string().optional(),
  subject: z.string().optional(),
  testMode: z.boolean().optional().default(false),
  testEmail: z.string().email().optional(),
  scheduleAt: z.string().datetime().optional(),
});

// POST /api/contentpilot/newsletter/send - Compile and send newsletter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newsletterId, title, subject, testMode, testEmail, scheduleAt } = SendNewsletterSchema.parse(body);

    let newsletter;
    
    if (newsletterId) {
      // Use existing newsletter
      newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId },
        include: {
          articles: {
            include: {
              article: true,
            },
            orderBy: { order: 'asc' },
          },
          subscribers: {
            where: { status: "SUBSCRIBED" },
          },
        },
      });

      if (!newsletter) {
        return Response.json(
          { error: "Newsletter not found" },
          { status: 404 }
        );
      }
    } else {
      // Create new newsletter with queued articles
      const queuedArticles = await prisma.article.findMany({
        where: { inNewsletterQueue: true },
        orderBy: { createdAt: 'desc' },
        take: 10, // Limit to 10 articles per newsletter
      });

      if (queuedArticles.length === 0) {
        return Response.json(
          { error: "No articles in queue for newsletter" },
          { status: 400 }
        );
      }

      // Create newsletter
      const newsletterTitle = title || `ContentPilot Daily Brief - ${new Date().toLocaleDateString()}`;
      const newsletterSubject = subject || `Your Daily Content Intelligence Brief`;

      newsletter = await prisma.newsletter.create({
        data: {
          title: newsletterTitle,
          subject: newsletterSubject,
          content: "", // Will be generated below
          status: testMode ? "DRAFT" : "SENT",
          scheduledAt: scheduleAt ? new Date(scheduleAt) : null,
          sentAt: testMode || scheduleAt ? null : new Date(),
        },
        include: {
          subscribers: {
            where: { status: "SUBSCRIBED" },
          },
        },
      });

      // Add articles to newsletter
      for (let i = 0; i < queuedArticles.length; i++) {
        await prisma.newsletter_article.create({
          data: {
            newsletterId: newsletter.id,
            articleId: queuedArticles[i].id,
            order: i,
          },
        });
      }

      // Re-fetch newsletter with articles
      newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletter.id },
        include: {
          articles: {
            include: {
              article: true,
            },
            orderBy: { order: 'asc' },
          },
          subscribers: {
            where: { status: "SUBSCRIBED" },
          },
        },
      });
    }

    if (!newsletter) {
      return Response.json(
        { error: "Failed to create or retrieve newsletter" },
        { status: 500 }
      );
    }

    // Generate newsletter content using our professional template
    const newsletterData = {
      title: newsletter.title,
      articles: newsletter.articles.map((na: { article: { 
        id: string; 
        title: string; 
        tldr?: string; 
        content: string; 
        sourceUrl?: string; 
        sourceName?: string; 
        topics: string[] 
      } }) => ({
        id: na.article.id,
        title: na.article.title,
        tldr: na.article.tldr || '',
        content: na.article.content,
        sourceUrl: na.article.sourceUrl,
        sourceName: na.article.sourceName,
        topics: na.article.topics || []
      })),
      brandName: "ContentPilot",
      date: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };

    const newsletterContent = generateNewsletterHTML(newsletterData);
    const newsletterTextContent = generateNewsletterText(newsletterData);

    // Update newsletter with generated content
    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { content: newsletterContent },
    });

    // Send newsletter
    const recipients = testMode && testEmail 
      ? [testEmail]
      : newsletter.subscribers.map(sub => sub.email);

    if (recipients.length === 0) {
      return Response.json({
        success: false,
        message: "No recipients found for newsletter",
        newsletter: {
          id: newsletter.id,
          title: newsletter.title,
          articleCount: newsletter.articles.length,
        },
      });
    }

    const emailResults: Array<{ email: string; success: boolean; error?: string; id?: string }> = [];
    
    if (!scheduleAt) {
      // Send immediately
      for (const email of recipients) {
        try {
          const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? "ContentPilot <newsletter@contentpilot.com>",
            to: [email],
            subject: newsletter.subject,
            html: newsletterContent,
            text: newsletterTextContent,
          });

          if (error) {
            console.error(`Failed to send to ${email}:`, error);
            emailResults.push({ email, success: false, error: error.message });
          } else {
            emailResults.push({ email, success: true, id: data?.id });
          }
        } catch (error) {
          console.error(`Error sending to ${email}:`, error);
          emailResults.push({ email, success: false, error: "Send failed" });
        }
      }

      // Update newsletter status
      if (!testMode) {
        await prisma.newsletter.update({
          where: { id: newsletter.id },
          data: { 
            status: "SENT",
            sentAt: new Date(),
          },
        });

        // Remove articles from queue if successfully sent
        await prisma.article.updateMany({
          where: {
            id: { in: newsletter.articles.map(na => na.article.id) },
          },
          data: { inNewsletterQueue: false },
        });
      }
    }

    return Response.json({
      success: true,
      newsletter: {
        id: newsletter.id,
        title: newsletter.title,
        subject: newsletter.subject,
        status: newsletter.status,
        articleCount: newsletter.articles.length,
        recipientCount: recipients.length,
        scheduledAt: newsletter.scheduledAt,
        sentAt: newsletter.sentAt,
      },
      sendResults: scheduleAt ? { scheduled: true } : {
        totalSent: emailResults.filter(r => r.success).length,
        totalFailed: emailResults.filter(r => !r.success).length,
        details: emailResults,
      },
      testMode,
    });

  } catch (error: unknown) {
    console.error("Newsletter send error:", error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to send newsletter" },
      { status: 500 }
    );
  }
}

 