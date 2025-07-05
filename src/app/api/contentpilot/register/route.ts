import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const RegisterSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().url(),
  version: z.string().min(1),
  capabilities: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, endpoint, version, capabilities } = RegisterSchema.parse(body);

    // Check if agent is already registered
    const existingAgent = await prisma.agent_registry.findUnique({
      where: { name },
    });

    let agent;
    if (existingAgent) {
      // Update existing agent
      agent = await prisma.agent_registry.update({
        where: { name },
        data: {
          endpoint,
          version,
          capabilities,
          status: "UP",
          lastHealthCheck: new Date(),
        },
      });
    } else {
      // Create new agent
      agent = await prisma.agent_registry.create({
        data: {
          name,
          endpoint,
          version,
          capabilities,
          status: "UP",
        },
      });
    }

    return Response.json({
      success: true,
      agentId: agent.id,
      message: existingAgent ? "Agent updated successfully" : "Agent registered successfully",
    });
  } catch (error: unknown) {
    console.error("Agent registration error:", error);
    
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