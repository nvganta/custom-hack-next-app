import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/contentpilot/topics - Fetch all topics
export async function GET() {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(topics);
  } catch {
    console.error("Failed to fetch topics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/contentpilot/topics - Create a new topic
export async function POST(request: NextRequest) {
  try {
    const topicData: { name: string } = await request.json();

    if (!topicData.name || !topicData.name.trim()) {
      return NextResponse.json({ error: "Topic name is required." }, { status: 400 });
    }

    const newTopic = await prisma.topic.create({
      data: { name: topicData.name.trim() },
    });

    return NextResponse.json(newTopic, { status: 201 });
  } catch {
    console.error("Failed to create topic:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
