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
    const apiKeysSettings = await prisma.setting.findMany({
      where: {
        key: {
          startsWith: 'api_key_',
        },
      },
      select: {
        key: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const apiKeys = apiKeysSettings.map(setting => ({
      id: setting.key,
      name: setting.key.replace('api_key_', '').replace(/_/g, ' '),
      keyPreview: 'cp_... (hidden)',
      createdAt: setting.createdAt,
      lastUsed: setting.updatedAt,
    }));

    return NextResponse.json({ apiKeys });
  } catch (error) {
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
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    const apiKey = generateApiKey();
    const keyId = `api_key_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Upsert the API key in the settings
    const setting = await prisma.setting.upsert({
      where: { key: keyId },
      update: { value: apiKey },
      create: {
        key: keyId,
        value: apiKey,
      },
    });

    return NextResponse.json({
      success: true,
      key: setting.value,
      name,
      message: 'API key generated successfully. Store it securely.',
    });
  } catch (error) {
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
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 
