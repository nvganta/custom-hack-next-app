import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const UpdateMemorySchema = z.object({
  userId: z.string().min(1),
  focusTopics: z.array(z.string()).optional(),
  preferredSources: z.array(z.string()).optional(),
  editorialStyle: z.string().optional(),
  notificationSettings: z.object({
    dailyBrief: z.boolean().optional(),
    newsletterUpdates: z.boolean().optional(),
    contentAlerts: z.boolean().optional(),
    frequency: z.enum(["DAILY", "WEEKLY", "NEVER"]).optional(),
  }).optional(),
});

// POST /api/contentpilot/memory/update - Update user preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, focusTopics, preferredSources, editorialStyle, notificationSettings } = UpdateMemorySchema.parse(body);

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

    // Check if preferences exist
    const existingPreferences = await prisma.user_preferences.findUnique({
      where: { userId },
    });

    const updateData: {
      focusTopics?: string[];
      preferredSources?: string[];
      editorialStyle?: string;
      notificationSettings?: Record<string, unknown>;
    } = {};
    
    if (focusTopics !== undefined) {
      updateData.focusTopics = focusTopics;
    }
    
    if (preferredSources !== undefined) {
      updateData.preferredSources = preferredSources;
    }
    
    if (editorialStyle !== undefined) {
      updateData.editorialStyle = editorialStyle;
    }
    
    if (notificationSettings !== undefined) {
      updateData.notificationSettings = notificationSettings as Record<string, unknown>;
    }

    if (existingPreferences) {
      // Update existing preferences
      await prisma.user_preferences.update({
        where: { userId },
        data: updateData,
      });
    } else {
      // Create new preferences
      await prisma.user_preferences.create({
        data: {
          userId,
          focusTopics: focusTopics || [],
          preferredSources: preferredSources || [],
          editorialStyle: editorialStyle || null,
          notificationSettings: (notificationSettings || null) as Record<string, unknown> | null,
        },
      });
    }

    // Get updated user profile for response
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
      },
    });

    return Response.json({
      success: true,
      message: "User preferences updated successfully",
      user: {
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
      },
      preferences: updatedUser!.preferences,
      changes: {
        focusTopics: focusTopics !== undefined,
        preferredSources: preferredSources !== undefined,
        editorialStyle: editorialStyle !== undefined,
        notificationSettings: notificationSettings !== undefined,
      },
    });

  } catch (error: unknown) {
    console.error("Memory update error:", error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to update user memory" },
      { status: 500 }
    );
  }
} 
