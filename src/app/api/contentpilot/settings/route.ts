import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/contentpilot/settings
 * Retrieves all settings, or a specific setting if a 'key' query param is provided.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  try {
    if (key) {
      const setting = await prisma.setting.findUnique({ where: { key } });
      // Initialize with a default if not found
      if (!setting && key === 'articlesPerCycle') {
        const defaultSetting = await prisma.setting.create({
          data: { key: 'articlesPerCycle', value: '10' }
        });
        return NextResponse.json(defaultSetting);
      }
      return NextResponse.json(setting);
    } else {
      const allSettings = await prisma.setting.findMany();
      return NextResponse.json(allSettings);
    }
  } catch {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/contentpilot/settings
 * Creates or updates a setting (upsert).
 * Expects a body with { key: string, value: string }.
 */
export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: "The 'key' and 'value' fields are required." }, { status: 400 });
    }

    const updatedSetting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json(updatedSetting, { status: 201 });
  } catch {
    console.error("Failed to save setting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
