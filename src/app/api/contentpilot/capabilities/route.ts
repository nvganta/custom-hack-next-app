import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const capabilities = {
      agent: {
        name: 'ContentPilot',
        version: '1.0.0',
        type: 'content-automation',
        description: 'Intelligent content discovery, generation, and newsletter automation agent'
      },
      capabilities: [
        {
          id: 'content-discovery',
          name: 'Content Discovery',
          description: 'Discovers relevant articles from various web sources using intelligent crawling',
          actions: ['trigger_intelligence'],
          inputs: ['sources', 'topics', 'keywords'],
          outputs: ['discovered_articles', 'intelligence_briefing']
        },
        {
          id: 'content-generation',
          name: 'Content Generation', 
          description: 'Generates original, high-quality articles based on discovered content',
          actions: ['generate_article', 'update_article'],
          inputs: ['source_content', 'topics', 'style_preferences'],
          outputs: ['generated_article', 'tldr_summary', 'topics']
        },
        {
          id: 'newsletter-management',
          name: 'Newsletter Management',
          description: 'Manages newsletter queue and distribution',
          actions: ['add_to_queue', 'remove_from_queue', 'send_newsletter'],
          inputs: ['articles', 'subscribers', 'templates'],
          outputs: ['newsletter_queue', 'sent_newsletter', 'delivery_stats']
        },
        {
          id: 'automation-scheduling',
          name: 'Automation & Scheduling',
          description: 'Automates content workflows with configurable scheduling',
          actions: ['update_automation', 'get_schedule', 'trigger_scheduled_task'],
          inputs: ['cron_schedule', 'automation_settings'],
          outputs: ['schedule_status', 'next_run_time', 'automation_history']
        },
        {
          id: 'human-oversight',
          name: 'Human Oversight',
          description: 'Provides human-in-the-loop capabilities for content review and approval',
          actions: ['flag_for_review', 'request_approval', 'escalate_issue'],
          inputs: ['content', 'confidence_score', 'review_criteria'],
          outputs: ['review_status', 'human_feedback', 'approval_decision']
        }
      ],
      endpoints: {
        health: '/api/contentpilot/agent',
        actions: '/api/contentpilot/agent',
        articles: '/api/contentpilot/articles',
        intelligence: '/api/contentpilot/intelligence',
        memory: '/api/contentpilot/memory',
        webhook: '/api/contentpilot/webhook',
        register: '/api/contentpilot/register'
      },
      supported_actions: [
        {
          action: 'trigger_intelligence',
          description: 'Initiates content discovery and generation process',
          method: 'POST',
          endpoint: '/api/contentpilot/agent',
          payload: {
            action: 'trigger_intelligence',
            payload: {
              sources: 'array of source URLs (optional)',
              topics: 'array of topics to focus on (optional)',
              limit: 'maximum number of articles to generate (optional)'
            }
          },
          response: {
            success: 'boolean',
            action: 'string',
            result: 'object with job details'
          }
        },
        {
          action: 'get_newsletter_queue',
          description: 'Retrieves articles currently in newsletter queue',
          method: 'POST',
          endpoint: '/api/contentpilot/agent',
          payload: {
            action: 'get_newsletter_queue'
          },
          response: {
            success: 'boolean',
            articles: 'array of queued articles'
          }
        },
        {
          action: 'send_newsletter',
          description: 'Sends newsletter with queued articles',
          method: 'POST',
          endpoint: '/api/contentpilot/agent',
          payload: {
            action: 'send_newsletter',
            payload: {
              template: 'newsletter template (optional)',
              subject: 'custom subject line (optional)'
            }
          },
          response: {
            success: 'boolean',
            result: 'object with send details'
          }
        },
        {
          action: 'update_automation',
          description: 'Updates automation settings and schedule',
          method: 'POST',
          endpoint: '/api/contentpilot/agent',
          payload: {
            action: 'update_automation',
            payload: {
              enabled: 'boolean',
              schedule: 'cron expression string'
            }
          },
          response: {
            success: 'boolean',
            settings: 'updated automation settings'
          }
        }
      ],
      authentication: {
        type: 'api-key',
        header: 'x-api-key',
        description: 'API key required in x-api-key header for all requests'
      },
      data_models: {
        article: {
          id: 'string',
          title: 'string',
          content: 'string',
          tldr: 'string',
          topics: 'array of strings',
          status: 'DRAFT | PUBLISHED | ARCHIVED',
          inNewsletterQueue: 'boolean',
          createdAt: 'ISO date string',
          updatedAt: 'ISO date string'
        },
        intelligence_briefing: {
          id: 'string',
          date: 'ISO date string',
          status: 'PROCESSING | READY | FAILED',
          articlesGenerated: 'number',
          topicsGathered: 'array of strings'
        },
        automation_settings: {
          enabled: 'boolean',
          schedule: 'cron expression string',
          nextRun: 'ISO date string',
          updatedAt: 'ISO date string'
        }
      },
      memory_capabilities: {
        current: 'MongoDB-based persistent storage',
        planned: 'Hybrid memory system with episodic, semantic, and working memory',
        endpoints: {
          query: '/api/contentpilot/memory/query',
          update: '/api/contentpilot/memory/update'
        }
      },
      integration: {
        async_support: true,
        webhook_notifications: true,
        job_tracking: true,
        human_in_loop: true,
        error_escalation: true
      },
      version_info: {
        api_version: '1.0.0',
        last_updated: new Date().toISOString(),
        compatibility: 'Maya v1.x, MCP-compatible'
      }
    };

    return NextResponse.json(capabilities);
  } catch {
    console.error('Error getting capabilities:', error);
    return NextResponse.json(
      { error: 'Failed to get capabilities' },
      { status: 500 }
    );
  }
} 
