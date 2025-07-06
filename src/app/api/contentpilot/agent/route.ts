import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Store agent start time for uptime calculation
const AGENT_START_TIME = new Date();

// Validate API key with database lookup
async function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'API key required' };
  }
  
  try {
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

// Get recent errors from logs
async function getRecentErrors() {
  try {
    const errorLogs = await prisma.setting.findMany({
      where: {
        key: {
          startsWith: 'error_log_'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    return errorLogs.map(log => {
      try {
        const errorData = JSON.parse(log.value);
        return {
          timestamp: log.createdAt,
          ...errorData
        };
      } catch {
        return {
          timestamp: log.createdAt,
          message: 'Failed to parse error log',
          level: 'error'
        };
      }
    });
  } catch {
    return [];
  }
}

// Log error for monitoring
async function logError(error: string, context: string, level: 'error' | 'warning' | 'info' = 'error') {
  try {
    const errorId = `error_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await prisma.setting.create({
      data: {
        key: errorId,
        value: JSON.stringify({
          message: error,
          context,
          level,
          timestamp: new Date().toISOString()
        })
      }
    });
  } catch (logErr) {
    console.error('Failed to log error:', logErr);
  }
}

// Calculate uptime
function getUptime() {
  const now = new Date();
  const uptimeMs = now.getTime() - AGENT_START_TIME.getTime();
  
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
  
  return {
    ms: uptimeMs,
    human: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    started_at: AGENT_START_TIME.toISOString()
  };
}

// GET /api/contentpilot/agent - Enhanced health and status reporting
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get latest intelligence briefing
    const latestBrief = await prisma.intelligence_briefing.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // Get system stats
    const stats = {
      totalArticles: await prisma.article.count(),
      articlesInQueue: await prisma.article.count({ where: { inNewsletterQueue: true } }),
      totalSources: await prisma.content_source.count(),
      totalSubscribers: await prisma.subscriber.count(),
      lastIntelligenceGather: latestBrief?.createdAt || null,
    };

    // Get automation settings
    let automationSettings = null;
    try {
      const setting = await prisma.setting.findFirst({
        where: { key: 'automation' }
      });
      if (setting) {
        automationSettings = JSON.parse(setting.value);
      }
    } catch {
      await logError('Failed to load automation settings', 'health_check', 'warning');
    }

    // Get webhook configuration
    let webhookStatus = null;
    try {
      const webhookSetting = await prisma.setting.findFirst({
        where: { key: 'webhook_config' }
      });
      if (webhookSetting) {
        const config = JSON.parse(webhookSetting.value);
        webhookStatus = {
          configured: true,
          active: config.active,
          events: config.events.length,
          url: config.url.replace(/\/\/.*@/, '//***@') // Hide credentials
        };
      } else {
        webhookStatus = { configured: false };
      }
    } catch {
      webhookStatus = { configured: false, error: 'Failed to load webhook config' };
    }

    // Get recent errors and warnings
    const recentErrors = await getRecentErrors();
    const errorCount = recentErrors.filter(e => e.level === 'error').length;
    const warningCount = recentErrors.filter(e => e.level === 'warning').length;

    // Check for warnings
    const warnings = [];
    if (!automationSettings?.enabled) {
      warnings.push('Automation is disabled');
    }
    if (!webhookStatus.configured) {
      warnings.push('No webhook configured for async notifications');
    }
    if (stats.articlesInQueue === 0) {
      warnings.push('Newsletter queue is empty');
    }
    if (stats.totalSources === 0) {
      warnings.push('No content sources configured');
    }

    // Calculate health score
    let healthScore = 100;
    if (errorCount > 0) healthScore -= (errorCount * 10);
    if (warningCount > 0) healthScore -= (warningCount * 5);
    if (warnings.length > 0) healthScore -= (warnings.length * 3);
    healthScore = Math.max(0, healthScore);

    const uptime = getUptime();

    return NextResponse.json({
      status: 'active',
      health_score: healthScore,
      timestamp: new Date().toISOString(),
      uptime,
      stats,
      automation: {
        enabled: automationSettings?.enabled || false,
        schedule: automationSettings?.schedule || null,
        nextRun: automationSettings?.nextRun || null,
      },
      webhook: webhookStatus,
      latestBrief: latestBrief ? {
        id: latestBrief.id,
        date: latestBrief.date,
        status: latestBrief.status,
        articleCount: latestBrief.articlesGenerated,
        createdAt: latestBrief.createdAt,
      } : null,
      monitoring: {
        errors: {
          recent_count: errorCount,
          last_24h: recentErrors.filter(e => 
            new Date(e.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
          ).length
        },
        warnings: {
          active: warnings,
          count: warnings.length
        },
        performance: {
          memory_usage: process.memoryUsage ? {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
          } : 'Not available',
          uptime_percentage: uptime.ms > 0 ? 99.9 : 100 // Simplified for now
        }
      },
      capabilities: {
        version: '1.0.0',
        features: [
          'content-discovery',
          'content-generation',
          'newsletter-management',
          'automation-scheduling',
          'human-oversight',
          'webhook-notifications',
          'memory-system',
          'api-key-auth'
        ]
      }
    });

  } catch {
    await logError(error instanceof Error ? error.message : 'Unknown error', 'health_check');
    console.error('Error getting ContentPilot status:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Failed to get status',
        timestamp: new Date().toISOString(),
        uptime: getUptime()
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/contentpilot/agent - Enhanced action handling with logging
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { action, payload } = await request.json();

    switch (action) {
      case 'trigger_intelligence':
        // Log the start of intelligence gathering
        await logError('Intelligence gathering started', 'intelligence', 'info');
        
        const response = await fetch(`${request.nextUrl.origin}/api/contentpilot/intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload || {}),
        });
        
        if (!response.ok) {
          await logError('Intelligence gathering failed', 'intelligence');
          throw new Error('Failed to trigger intelligence gathering');
        }
        
        const result = await response.json();
        
        // Send webhook notification if configured
        try {
          const { notifyWebhook } = await import('../webhook/route');
          await notifyWebhook('intelligence.started', {
            trigger: 'api',
            payload: payload || {},
            started_at: new Date().toISOString()
          });
        } catch (webhookError) {
          console.log('Webhook notification failed:', webhookError);
        }
        
        return NextResponse.json({
          success: true,
          action: 'intelligence_triggered',
          result,
        });

      case 'get_newsletter_queue':
        const queuedArticles = await prisma.article.findMany({
          where: { inNewsletterQueue: true },
          include: {
            author: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        
        return NextResponse.json({
          success: true,
          action: 'newsletter_queue_retrieved',
          articles: queuedArticles,
        });

      case 'send_newsletter':
        const newsletterResponse = await fetch(`${request.nextUrl.origin}/api/contentpilot/newsletter/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload || {}),
        });
        
        if (!newsletterResponse.ok) {
          await logError('Newsletter sending failed', 'newsletter');
          throw new Error('Failed to send newsletter');
        }
        
        const newsletterResult = await newsletterResponse.json();
        
        // Send webhook notification
        try {
          const { notifyWebhook } = await import('../webhook/route');
          await notifyWebhook('newsletter.sent', newsletterResult);
        } catch (webhookError) {
          console.log('Webhook notification failed:', webhookError);
        }
        
        return NextResponse.json({
          success: true,
          action: 'newsletter_sent',
          result: newsletterResult,
        });

      case 'update_automation':
        const { enabled, schedule } = payload || {};
        
        const settingsValue = JSON.stringify({
          enabled: enabled || false,
          schedule: schedule || '0 9 * * 1,3,5',
          updatedAt: new Date().toISOString(),
        });

        const updatedSettings = await prisma.setting.upsert({
          where: { key: 'automation' },
          update: {
            value: settingsValue,
            updatedAt: new Date(),
          },
          create: {
            key: 'automation',
            value: settingsValue,
          },
        });
        
        // Send webhook notification
        try {
          const { notifyWebhook } = await import('../webhook/route');
          await notifyWebhook(enabled ? 'automation.enabled' : 'automation.disabled', {
            settings: JSON.parse(updatedSettings.value)
          });
        } catch (webhookError) {
          console.log('Webhook notification failed:', webhookError);
        }
        
        return NextResponse.json({
          success: true,
          action: 'automation_updated',
          settings: JSON.parse(updatedSettings.value),
        });

      default:
        await logError(`Unknown action: ${action}`, 'api', 'warning');
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch {
    await logError(error instanceof Error ? error.message : 'Unknown error', 'agent_action');
    console.error('Error processing agent request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Export logging function for use in other parts of the application
export { logError }; 
