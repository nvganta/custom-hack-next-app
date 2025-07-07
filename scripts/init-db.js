const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initializeDatabase() {
  console.log('🚀 Initializing ContentPilot database...');
  
  try {
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
            value: 'true',
            description: 'Enable email notifications for intelligence gathering'
          },
          {
            key: 'notificationEmail',
            value: 'admin@example.com',
            description: 'Email address for notifications'
          },
          {
            key: 'automation',
            value: JSON.stringify({
              enabled: false,
              schedule: 'daily',
              maxArticles: 5,
              topics: ['technology', 'business']
            }),
            description: 'Automation settings'
          },
          {
            key: 'webhook_config',
            value: JSON.stringify({
              active: false,
              url: '',
              events: ['article.created', 'newsletter.sent']
            }),
            description: 'Webhook configuration'
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
            isActive: true,
            topics: ['technology', 'startups', 'business']
          },
          {
            name: 'Hacker News',
            url: 'https://news.ycombinator.com',
            type: 'news',
            isActive: true,
            topics: ['technology', 'programming', 'startups']
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
          { name: 'Technology', description: 'Latest tech news and trends' },
          { name: 'Business', description: 'Business and entrepreneurship' },
          { name: 'AI', description: 'Artificial Intelligence and Machine Learning' },
          { name: 'Startups', description: 'Startup news and funding' },
          { name: 'Programming', description: 'Software development and coding' }
        ]
      });
      
      console.log('✅ Sample topics created');
    }
    
    console.log('🎉 Database initialization complete!');
    console.log('📊 Database Summary:');
    console.log(`   - Settings: ${await prisma.setting.count()}`);
    console.log(`   - Content Sources: ${await prisma.content_source.count()}`);
    console.log(`   - Topics: ${await prisma.topic.count()}`);
    console.log(`   - Articles: ${await prisma.article.count()}`);
    console.log(`   - Subscribers: ${await prisma.subscriber.count()}`);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('✅ Initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase }; 