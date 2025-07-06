import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Store webhook configurations
interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  headers?: Record<string, string>;
}

// Validate API key
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

// POST /api/contentpilot/webhook - Configure webhook endpoints
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { action, webhook_url, events, secret, headers } = await request.json();

    if (action === 'configure') {
      if (!webhook_url || !events || !Array.isArray(events)) {
        return NextResponse.json(
          { error: 'webhook_url and events array are required' },
          { status: 400 }
        );
      }

      const webhookConfig: WebhookConfig = {
        url: webhook_url,
        events,
        secret,
        active: true,
        headers: headers || {}
      };

      // Store webhook configuration
      await prisma.setting.upsert({
        where: { key: 'webhook_config' },
        update: {
          value: JSON.stringify(webhookConfig),
          updatedAt: new Date(),
        },
        create: {
          key: 'webhook_config',
          value: JSON.stringify(webhookConfig),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook configured successfully',
        config: {
          url: webhook_url,
          events,
          active: true,
          configured_at: new Date().toISOString()
        }
      });

    } else if (action === 'test') {
      // Send test webhook
      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        agent: 'ContentPilot',
        data: {
          message: 'This is a test webhook from ContentPilot',
          status: 'active',
          test_id: Math.random().toString(36).substr(2, 9)
        }
      };

      const success = await sendWebhook('webhook.test', testPayload);
      
      return NextResponse.json({
        success,
        message: success ? 'Test webhook sent successfully' : 'Failed to send test webhook',
        payload: testPayload
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "configure" or "test"' },
        { status: 400 }
      );
    }

  } catch {
    console.error('Error configuring webhook:', _error);
    return NextResponse.json(
      { error: 'Failed to configure webhook' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/contentpilot/webhook - Get webhook configuration
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const webhookSetting = await prisma.setting.findFirst({
      where: { key: 'webhook_config' }
    });

    if (!webhookSetting) {
      return NextResponse.json({
        configured: false,
        message: 'No webhook configured'
      });
    }

    const config = JSON.parse(webhookSetting.value);
    
    return NextResponse.json({
      configured: true,
      config: {
        url: config.url,
        events: config.events,
        active: config.active,
        has_secret: !!config.secret,
        headers: Object.keys(config.headers || {}),
        configured_at: webhookSetting.createdAt
      },
      supported_events: [
        'intelligence.started',
        'intelligence.completed',
        'intelligence.failed',
        'article.created',
        'article.updated',
        'newsletter.queued',
        'newsletter.sent',
        'automation.enabled',
        'automation.disabled',
        'error.escalated',
        'webhook.test'
      ]
    });

  } catch {
    console.error('Error getting webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/contentpilot/webhook - Remove webhook configuration
export async function DELETE(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    await prisma.setting.deleteMany({
      where: { key: 'webhook_config' }
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration removed'
    });

  } catch {
    console.error('Error removing webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to remove webhook configuration' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Utility function to send webhook notifications
export async function sendWebhook(event: string, data: unknown): Promise<boolean> {
  try {
    const webhookSetting = await prisma.setting.findFirst({
      where: { key: 'webhook_config' }
    });

    if (!webhookSetting) {
      console.log('No webhook configured, skipping notification');
      return false;
    }

    const config: WebhookConfig = JSON.parse(webhookSetting.value);
    
    if (!config.active || !config.events.includes(event)) {
      console.log(`Webhook not configured for event: ${event}`);
      return false;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      agent: 'ContentPilot',
      data
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ContentPilot-Agent/1.0.0',
      ...config.headers
    };

    // Add signature if secret is configured
    if (config.secret) {
      const signature = crypto
        .createHmac('sha256', config.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-ContentPilot-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`Webhook sent successfully for event: ${event}`);
    return true;

  } catch {
    console.error('Error sending webhook:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Export the sendWebhook function for use in other parts of the application
export { sendWebhook as notifyWebhook }; 
