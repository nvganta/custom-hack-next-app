import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { mayaEndpoint, registrationToken } = await request.json();
    
    if (!mayaEndpoint) {
      return NextResponse.json(
        { error: 'Maya endpoint is required for registration' },
        { status: 400 }
      );
    }

    // Agent information to register with Maya
    const agentInfo = {
      name: 'ContentPilot',
      type: 'content-automation',
      version: '1.0.0',
      description: 'Intelligent content discovery, generation, and newsletter automation agent',
      capabilities: [
        'content-discovery',
        'content-generation', 
        'newsletter-management',
        'automation-scheduling',
        'human-oversight'
      ],
      endpoints: {
        base: `${request.nextUrl.origin}/api/contentpilot`,
        health: `${request.nextUrl.origin}/api/contentpilot/agent`,
        actions: `${request.nextUrl.origin}/api/contentpilot/agent`,
        capabilities: `${request.nextUrl.origin}/api/contentpilot/capabilities`,
        memory: `${request.nextUrl.origin}/api/contentpilot/memory`,
        webhook: `${request.nextUrl.origin}/api/contentpilot/webhook`,
      },
      authentication: {
        type: 'api-key',
        headerName: 'x-api-key',
        description: 'API key required in x-api-key header'
      },
      status: 'active',
      lastSeen: new Date().toISOString(),
      metadata: {
        framework: 'Next.js',
        database: 'MongoDB',
        language: 'TypeScript'
      }
    };

    // Store registration info in database
    await prisma.setting.upsert({
      where: { key: 'maya_registration' },
      update: {
        value: JSON.stringify({
          mayaEndpoint,
          registeredAt: new Date().toISOString(),
          agentInfo,
          status: 'registered'
        }),
        updatedAt: new Date(),
      },
      create: {
        key: 'maya_registration',
        value: JSON.stringify({
          mayaEndpoint,
          registeredAt: new Date().toISOString(),
          agentInfo,
          status: 'registered'
        }),
      },
    });

    // Attempt to register with Maya
    try {
      const registrationResponse = await fetch(`${mayaEndpoint}/agents/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(registrationToken && { 'Authorization': `Bearer ${registrationToken}` })
        },
        body: JSON.stringify(agentInfo),
      });

      if (!registrationResponse.ok) {
        const errorData = await registrationResponse.text();
        throw new Error(`Maya registration failed: ${errorData}`);
      }

      const mayaResponse = await registrationResponse.json();

      return NextResponse.json({
        success: true,
        message: 'Successfully registered with Maya',
        agentInfo,
        mayaResponse,
        registeredAt: new Date().toISOString(),
      });

    } catch (mayaError) {
      // Store registration attempt even if Maya registration fails
      await prisma.setting.upsert({
        where: { key: 'maya_registration' },
        update: {
          value: JSON.stringify({
            mayaEndpoint,
            registeredAt: new Date().toISOString(),
            agentInfo,
            status: 'failed',
            error: mayaError instanceof Error ? mayaError.message : 'Unknown error'
          }),
          updatedAt: new Date(),
        },
        create: {
          key: 'maya_registration',
          value: JSON.stringify({
            mayaEndpoint,
            registeredAt: new Date().toISOString(),
            agentInfo,
            status: 'failed',
            error: mayaError instanceof Error ? mayaError.message : 'Unknown error'
          }),
        },
      });

      return NextResponse.json({
        success: false,
        message: 'Agent info stored locally, but Maya registration failed',
        agentInfo,
        error: mayaError instanceof Error ? mayaError.message : 'Unknown error',
        registeredAt: new Date().toISOString(),
      }, { status: 207 }); // 207 Multi-Status (partial success)
    }

  } catch {
    console.error('Error during agent registration:');
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET endpoint to check registration status
export async function GET(_request: NextRequest) {
  try {
    const registration = await prisma.setting.findFirst({
      where: { key: 'maya_registration' }
    });

    if (!registration) {
      return NextResponse.json({
        registered: false,
        message: 'Agent not yet registered with Maya'
      });
    }

    const registrationData = JSON.parse(registration.value);
    
    return NextResponse.json({
      registered: true,
      status: registrationData.status,
      registeredAt: registrationData.registeredAt,
      mayaEndpoint: registrationData.mayaEndpoint,
      agentInfo: registrationData.agentInfo,
      error: registrationData.error || null,
    });

  } catch {
    console.error('Error checking registration status:');
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    // Deregister the ContentPilot agent
    const agent = await prisma.agent_registry.findUnique({
      where: { name: "ContentPilot" },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "ContentPilot agent not found" },
        { status: 404 }
      );
    }

    await prisma.agent_registry.delete({
      where: { name: "ContentPilot" },
    });

    return NextResponse.json({
      message: "ContentPilot agent deregistered successfully",
      deregisteredAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Error deregistering ContentPilot agent:", error);
    return NextResponse.json(
      { error: "Failed to deregister agent" },
      { status: 500 }
    );
  }
} 
