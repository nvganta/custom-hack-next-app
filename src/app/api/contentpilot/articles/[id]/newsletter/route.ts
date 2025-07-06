import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { inNewsletterQueue } = await request.json();
    const articleId = params.id;

    const updatedArticle = await prisma.article.update({
      where: { id: articleId },
      data: { inNewsletterQueue },
      include: {
        source: true,
        author: true,
      },
    });

    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error('Error updating newsletter status:', error);
    return NextResponse.json(
      { error: 'Failed to update newsletter status' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 