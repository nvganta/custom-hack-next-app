import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/contentpilot/subscribers - Fetch all subscribers
export async function GET() {
  try {
    // Let's add some dummy data if none exists, for UI development purposes
    const count = await prisma.subscriber.count();
    if (count === 0) {
      await prisma.subscriber.createMany({
        data: [
          { email: 'subscriber1@example.com', name: 'Alice' },
          { email: 'subscriber2@example.com', name: 'Bob' },
          { email: 'subscriber3@example.com', name: 'Charlie' },
        ],
      });
    }

    const subscribers = await prisma.subscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(subscribers);
  } catch (error) {
    console.error("Failed to fetch subscribers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 