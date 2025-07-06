import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const DeregisterSchema = z.object({
  agentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId } = DeregisterSchema.parse(body);

    // Update agent status to DOWN or delete the record
    await prisma.agent_registry.update({
      where: { id: agentId },
      data: {
        status: "DOWN",
        lastHealthCheck: new Date(),
      },
    });

    return Response.json({
      success: true,
      message: "Agent deregistered successfully",
    });
  } catch (error: unknown) {
    console.error("Agent deregistration error:", error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
