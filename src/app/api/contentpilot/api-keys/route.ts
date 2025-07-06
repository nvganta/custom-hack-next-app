import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'cp_'; // ContentPilot prefix
  const randomPart = randomBytes(32).toString('hex');
  return `${prefix}${randomPart}`;
}

// GET /api/contentpilot/api-keys - List API keys (admin only)
export async function GET() {
  try {
    const apiKeys = await prisma.api_key.findMany({
      select: {
        id: true,
        name: true,
        keyPreview: true,
        createdAt: true,
        lastUsed: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ apiKeys });
  } catch {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/contentpilot/api-keys - Generate new API key
export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    const apiKey = generateApiKey();
    const keyId = `api_key_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Store the API key
    await prisma.setting.create({
      data: {
        key: keyId,
        value: JSON.stringify({
          apiKey,
          name,
          description: description || '',
          createdAt: new Date().toISOString(),
          isActive: true,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      apiKey,
      name,
      keyId: keyId.replace('api_key_', ''),
      message: 'API key generated successfully. Store it securely - you won\'t be able to see it again.',
    });
  } catch {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/contentpilot/api-keys/[keyId] - Revoke API key
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID is required' },
        { status: 400 }
      );
    }

    await prisma.setting.delete({
      where: {
        key: `api_key_${keyId}`
      }
    });

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 
