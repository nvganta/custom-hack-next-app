import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const CreateSubscriberSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address'),
});

// GET /api/contentpilot/subscribers - List all subscribers
export async function GET() {
  try {
    const subscribers = await prisma.subscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscribers' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/contentpilot/subscribers - Add new subscriber
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = CreateSubscriberSchema.parse(body);

    // Check if subscriber already exists
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { email },
    });

    if (existingSubscriber) {
      return NextResponse.json(
        { error: 'Email already subscribed' },
        { status: 400 }
      );
    }

    // Create new subscriber
    const subscriber = await prisma.subscriber.create({
      data: {
        name: name || null,
        email,
        status: 'SUBSCRIBED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(subscriber);
  } catch (error: unknown) {
    console.error('Subscriber creation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create subscriber' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 
