import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/contentpilot/sources - Fetch all content sources
export async function GET() {
  try {
    const sources = await prisma.content_source.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(sources);
  } catch (error) {
    console.error("Failed to fetch sources:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/contentpilot/sources - Create a new content source
export async function POST(request: NextRequest) {
  try {
    const sourceData: { name: string; url: string; type: string } = await request.json();

    if (!sourceData.name || !sourceData.url || !sourceData.type) {
      return NextResponse.json({ error: "Name, URL, and type are required." }, { status: 400 });
    }

    const newSource = await prisma.content_source.create({
      data: {
        name: sourceData.name,
        url: sourceData.url,
        type: sourceData.type,
        isActive: true,
      },
    });

    return NextResponse.json(newSource, { status: 201 });
  } catch (error) {
    console.error("Failed to create source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 
