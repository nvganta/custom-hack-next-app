import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ArticleFilters {
  date?: string;
  status?: string;
  search?: string;
  topics?: string;
}

interface NotificationPayload {
  title: string;
  content: string;
  tldr: string;
  articleId: string;
}

// GET /api/contentpilot/articles - List articles with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const filters: ArticleFilters = {
      date: searchParams.get('date') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      topics: searchParams.get('topics') || undefined,
    };

    // Build where clause dynamically
    const where: Record<string, unknown> = {};

    // Date filtering
    if (filters.date) {
      const startDate = new Date(filters.date);
      const endDate = new Date(filters.date);
      endDate.setHours(23, 59, 59, 999);
      
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Status filtering
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status.toUpperCase();
    }

    // Search filtering
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
        { tldr: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Topics filtering
    if (filters.topics) {
      const topicList = filters.topics.split(',').map(t => t.trim());
      where.topics = {
        hasSome: topicList,
      };
    }

    const articles = await prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({ articles });
  } catch {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

// POST /api/contentpilot/articles - Create new article
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, tldr, topics, status, authorId, sendNotification } = body;

    // Create the article
    const article = await prisma.article.create({
      data: {
        title,
        content,
        tldr,
        topics: topics || [],
        status: status || 'DRAFT',
        authorId: authorId || null,
        inNewsletterQueue: false,
      },
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

    // Send notification if requested
    if (sendNotification) {
      try {
        const notificationData: NotificationPayload = {
          title: article.title,
          content: article.content || '',
          tldr: article.tldr || '',
          articleId: article.id,
        };

        const notificationResponse = await fetch(`${request.nextUrl.origin}/api/contentpilot/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationData),
        });

        if (!notificationResponse.ok) {
          console.warn('Failed to send notification, but article was created successfully');
        }
      } catch (notificationError) {
        console.warn('Notification failed:', notificationError);
        // Don't fail the article creation if notification fails
      }
    }

    return NextResponse.json({ article }, { status: 201 });
  } catch {
    console.error('Error creating article:', error);
    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
} 
