import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Initializing ContentPilot database...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Create initial settings if they don't exist
    const existingSettings = await prisma.setting.findMany();
    
    if (existingSettings.length === 0) {
      console.log('📝 Creating initial settings...');
      
      // Create initial settings
      await prisma.setting.createMany({
        data: [
          {
            key: 'enableEmailNotifications',
            value: 'true'
          },
          {
            key: 'notificationEmail',
            value: 'admin@example.com'
          },
          {
            key: 'automation',
            value: JSON.stringify({
              enabled: false,
              schedule: 'daily',
              maxArticles: 5,
              topics: ['technology', 'business']
            })
          },
          {
            key: 'webhook_config',
            value: JSON.stringify({
              active: false,
              url: '',
              events: ['article.created', 'newsletter.sent']
            })
          }
        ]
      });
      
      console.log('✅ Initial settings created');
    }
    
    // Check if we have any content sources
    const sources = await prisma.content_source.findMany();
    if (sources.length === 0) {
      console.log('📰 Creating sample content sources...');
      
      await prisma.content_source.createMany({
        data: [
          {
            name: 'TechCrunch',
            url: 'https://techcrunch.com',
            type: 'news',
            isActive: true
          },
          {
            name: 'Hacker News',
            url: 'https://news.ycombinator.com',
            type: 'news',
            isActive: true
          }
        ]
      });
      
      console.log('✅ Sample content sources created');
    }
    
    // Create sample topics if none exist
    const topics = await prisma.topic.findMany();
    if (topics.length === 0) {
      console.log('🏷️ Creating sample topics...');
      
      await prisma.topic.createMany({
        data: [
          { name: 'Technology' },
          { name: 'Business' },
          { name: 'AI' },
          { name: 'Startups' },
          { name: 'Programming' }
        ]
      });
      
      console.log('✅ Sample topics created');
    }
    
    // Get final counts
    const stats = {
      settings: await prisma.setting.count(),
      contentSources: await prisma.content_source.count(),
      topics: await prisma.topic.count(),
      articles: await prisma.article.count(),
      subscribers: await prisma.subscriber.count()
    };
    
    console.log('🎉 Database initialization complete!');
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      stats
    });
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  try {
    await prisma.$connect();
    
    const stats = {
      settings: await prisma.setting.count(),
      contentSources: await prisma.content_source.count(),
      topics: await prisma.topic.count(),
      articles: await prisma.article.count(),
      subscribers: await prisma.subscriber.count()
    };
    
    return NextResponse.json({
      success: true,
      message: 'Database status',
      stats,
      initialized: stats.settings > 0
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 