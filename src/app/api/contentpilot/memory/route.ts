import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Validate API key for memory operations
async function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'API key required' };
  }
  
  try {
    // Check database-stored API keys
    const storedKeys = await prisma.setting.findMany({
      where: { key: { startsWith: 'api_key_' } }
    });
    
    const validKey = storedKeys.find(keyRecord => {
      try {
        const keyData = JSON.parse(keyRecord.value);
        return keyData.apiKey === apiKey && keyData.isActive;
      } catch {
        return false;
      }
    });
    
    if (!validKey) {
      // Fallback to environment variables
      const envApiKeys = [
        process.env.CONTENTPILOT_API_KEY,
        process.env.CENTRAL_AGENT_API_KEY,
      ].filter(Boolean);
      
      if (!envApiKeys.includes(apiKey)) {
        return { valid: false, error: 'Invalid API key' };
      }
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'API key validation failed' };
  }
}

// GET /api/contentpilot/memory - Query memory system
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const type = searchParams.get('type') || 'all'; // semantic, episodic, working, all
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Current implementation: Query existing MongoDB data as semantic memory
    const memoryResults = await prisma.user_memory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    switch (type) {
      case 'semantic':
      case 'all':
        // Query articles as semantic memory
        const articles = await prisma.article.findMany({
          where: query ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
              { tldr: { contains: query, mode: 'insensitive' } },
              { topics: { has: query } }
            ]
          } : {},
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            tldr: true,
            topics: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        });

        memoryResults.push({
          type: 'semantic',
          category: 'articles',
          count: articles.length,
          data: articles.map(article => ({
            id: article.id,
            type: 'article',
            content: {
              title: article.title,
              summary: article.tldr,
              topics: article.topics,
              status: article.status
            },
            metadata: {
              created: article.createdAt,
              updated: article.updatedAt,
              relevance_score: query ? calculateRelevanceScore(article, query) : 1.0
            }
          }))
        });

        // Query intelligence briefings as episodic memory
        if (type === 'all') {
          const briefings = await prisma.intelligence_briefing.findMany({
            take: Math.min(limit, 5),
            skip: offset,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              date: true,
              status: true,
              articlesGenerated: true,
              topicsGathered: true,
              createdAt: true
            }
          });

          memoryResults.push({
            type: 'episodic',
            category: 'intelligence_briefings',
            count: briefings.length,
            data: briefings.map(briefing => ({
              id: briefing.id,
              type: 'intelligence_session',
              content: {
                date: briefing.date,
                status: briefing.status,
                articles_generated: briefing.articlesGenerated,
                topics_covered: briefing.topicsGathered
              },
              metadata: {
                created: briefing.createdAt,
                session_type: 'intelligence_gathering'
              }
            }))
          });
        }
        break;

      case 'episodic':
        // Query intelligence briefings and user actions as episodic memory
        const briefings = await prisma.intelligence_briefing.findMany({
          where: query ? {
            OR: [
              { topicsGathered: { has: query } },
              { status: { contains: query, mode: 'insensitive' } }
            ]
          } : {},
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' }
        });

        memoryResults.push({
          type: 'episodic',
          category: 'intelligence_sessions',
          count: briefings.length,
          data: briefings.map(briefing => ({
            id: briefing.id,
            type: 'intelligence_session',
            content: briefing,
            metadata: {
              created: briefing.createdAt,
              session_type: 'intelligence_gathering'
            }
          }))
        });
        break;

      case 'working':
        // Working memory: Current active tasks, recent user interactions
        // For now, return placeholder structure
        memoryResults.push({
          type: 'working',
          category: 'active_tasks',
          count: 0,
          data: [],
          note: 'Working memory system not yet implemented - placeholder for future upgrade'
        });
        break;
    }

    return NextResponse.json({
      success: true,
      query: query || 'all',
      type,
      limit,
      offset,
      total_categories: memoryResults.length,
      memory: memoryResults,
      capabilities: {
        current: 'MongoDB-based semantic and episodic memory',
        planned: 'Hybrid memory system with Mem0 integration',
        supported_types: ['semantic', 'episodic', 'working (planned)']
      },
      timestamp: new Date().toISOString()
    });

  } catch {
    console.error('Error querying memory:', error);
    return NextResponse.json(
      { error: 'Failed to query memory' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/contentpilot/memory - Update/store memory
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { type, category, content, metadata } = await request.json();

    if (!type || !category || !content) {
      return NextResponse.json(
        { error: 'type, category, and content are required' },
        { status: 400 }
      );
    }

    // Store memory entry in settings for now
    const memoryId = `memory_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const memoryEntry = {
      id: memoryId,
      type,
      category,
      content,
      metadata: {
        ...metadata,
        created: new Date().toISOString(),
        source: 'api'
      }
    };

    await prisma.setting.create({
      data: {
        key: memoryId,
        value: JSON.stringify(memoryEntry)
      }
    });

    return NextResponse.json({
      success: true,
      memory_id: memoryId,
      message: 'Memory entry stored successfully',
      entry: memoryEntry,
      note: 'Currently stored in settings table - will be migrated to dedicated memory system'
    });

  } catch {
    console.error('Error storing memory:', error);
    return NextResponse.json(
      { error: 'Failed to store memory' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to calculate relevance score for search results
function calculateRelevanceScore(article: any, query: string): number {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Title match (highest weight)
  if (article.title?.toLowerCase().includes(queryLower)) {
    score += 0.5;
  }

  // TL;DR match (medium weight)
  if (article.tldr?.toLowerCase().includes(queryLower)) {
    score += 0.3;
  }

  // Topics match (medium weight)
  if (article.topics?.some((topic: string) => topic.toLowerCase().includes(queryLower))) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
} 
