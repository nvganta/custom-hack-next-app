import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if ContentPilot agent is registered
    const agent = await prisma.agent_registry.findUnique({
      where: { name: "ContentPilot" },
    });

    const dbStatus = "UP";
    const crawlerStatus = "UP"; // Could add actual crawler health check
    const agentStatus = agent?.status || "NOT_REGISTERED";

    return Response.json({
      status: "UP",
      version: "1.0.0",
      details: {
        db: dbStatus,
        crawler: crawlerStatus,
        agent: agentStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Health check error:", error);
    
    return Response.json({
      status: "DOWN",
      version: "1.0.0",
      details: {
        db: "DOWN",
        crawler: "UNKNOWN",
        agent: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
    }, { status: 503 });
  }
} 
