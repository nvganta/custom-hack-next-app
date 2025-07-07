import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

export interface EscalationItem {
  id: string;
  type: 'low_confidence' | 'error' | 'review_required' | 'quality_concern' | 'manual_intervention';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  context: any;
  confidence_score?: number;
  error_details?: any;
  suggested_actions?: string[];
  related_entities?: {
    article_id?: string;
    job_id?: string;
    user_id?: string;
  };
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
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

// Create escalation item
async function createEscalationInternal(
  type: EscalationItem['type'],
  priority: EscalationItem['priority'],
  title: string,
  description: string,
  context: any,
  relatedEntities?: EscalationItem['related_entities'],
  confidenceScore?: number,
  errorDetails?: any,
  suggestedActions?: string[]
): Promise<string> {
  const escalationId = `escalation_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const escalation: EscalationItem = {
    id: escalationId,
    type,
    priority,
    title,
    description,
    context,
    confidence_score: confidenceScore,
    error_details: errorDetails,
    suggested_actions: suggestedActions,
    related_entities: relatedEntities,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await prisma.setting.create({
    data: {
      key: escalationId,
      value: JSON.stringify(escalation)
    }
  });

  // Log the escalation
  await logger.warn(
    `New escalation created: ${title}`,
    `escalation:${type}`,
    {
      escalation_id: escalationId,
      priority,
      type,
      confidence_score: confidenceScore,
      related_entities: relatedEntities
    }
  );

  // Send webhook notification
  try {
    const { notifyWebhook } = await import('../webhook/route');
    await notifyWebhook('escalation.created', {
      escalation_id: escalationId,
      type,
      priority,
      title,
      confidence_score: confidenceScore,
      requires_immediate_attention: priority === 'critical'
    });
  } catch (webhookError) {
    console.log('Webhook notification failed for escalation:', webhookError);
  }

  return escalationId;
}

// GET /api/contentpilot/escalation - List escalations with filtering
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as EscalationItem['status'] | null;
    const type = searchParams.get('type') as EscalationItem['type'] | null;
    const priority = searchParams.get('priority') as EscalationItem['priority'] | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get all escalation entries
    const escalationSettings = await prisma.setting.findMany({
      where: {
        key: {
          startsWith: 'escalation_'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit + offset,
      skip: offset
    });

    let escalations = escalationSettings.map(setting => {
      try {
        return JSON.parse(setting.value) as EscalationItem;
      } catch {
        return null;
      }
    }).filter(Boolean) as EscalationItem[];

    // Apply filters
    if (status) {
      escalations = escalations.filter(e => e.status === status);
    }
    if (type) {
      escalations = escalations.filter(e => e.type === type);
    }
    if (priority) {
      escalations = escalations.filter(e => e.priority === priority);
    }

    // Apply pagination
    const paginatedEscalations = escalations.slice(0, limit);

    // Calculate summary stats
    const stats = {
      total: escalations.length,
      pending: escalations.filter(e => e.status === 'pending').length,
      in_review: escalations.filter(e => e.status === 'in_review').length,
      resolved: escalations.filter(e => e.status === 'resolved').length,
      dismissed: escalations.filter(e => e.status === 'dismissed').length,
      by_priority: {
        critical: escalations.filter(e => e.priority === 'critical').length,
        high: escalations.filter(e => e.priority === 'high').length,
        medium: escalations.filter(e => e.priority === 'medium').length,
        low: escalations.filter(e => e.priority === 'low').length
      },
      by_type: {
        low_confidence: escalations.filter(e => e.type === 'low_confidence').length,
        error: escalations.filter(e => e.type === 'error').length,
        review_required: escalations.filter(e => e.type === 'review_required').length,
        quality_concern: escalations.filter(e => e.type === 'quality_concern').length,
        manual_intervention: escalations.filter(e => e.type === 'manual_intervention').length
      }
    };

    return NextResponse.json({
      success: true,
      escalations: paginatedEscalations,
      pagination: {
        limit,
        offset,
        total: escalations.length,
        has_more: offset + limit < escalations.length
      },
      stats,
      filters: {
        status,
        type,
        priority
      }
    });

  } catch (error) {
    await logger.error('Error getting escalations', 'escalation_api', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to get escalations' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/contentpilot/escalation - Create new escalation
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const {
      type,
      priority,
      title,
      description,
      context,
      related_entities,
      confidence_score,
      error_details,
      suggested_actions
    } = await request.json();

    if (!type || !priority || !title || !description) {
      return NextResponse.json(
        { error: 'type, priority, title, and description are required' },
        { status: 400 }
      );
    }

    const escalationId = await createEscalationInternal(
      type,
      priority,
      title,
      description,
      context,
      related_entities,
      confidence_score,
      error_details,
      suggested_actions
    );

    return NextResponse.json({
      success: true,
      escalation_id: escalationId,
      message: 'Escalation created successfully'
    });

  } catch (error) {
    await logger.error('Error creating escalation', 'escalation_api', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to create escalation' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/contentpilot/escalation - Update escalation status
export async function PUT(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const {
      escalation_id,
      status,
      resolved_by,
      resolution_notes
    } = await request.json();

    if (!escalation_id || !status) {
      return NextResponse.json(
        { error: 'escalation_id and status are required' },
        { status: 400 }
      );
    }

    const escalationSetting = await prisma.setting.findFirst({
      where: { key: escalation_id }
    });

    if (!escalationSetting) {
      return NextResponse.json(
        { error: 'Escalation not found' },
        { status: 404 }
      );
    }

    const escalation: EscalationItem = JSON.parse(escalationSetting.value);
    const updatedEscalation = {
      ...escalation,
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'resolved' && {
        resolved_at: new Date().toISOString(),
        resolved_by,
        resolution_notes
      })
    };

    await prisma.setting.update({
      where: { key: escalation_id },
      data: {
        value: JSON.stringify(updatedEscalation),
        updatedAt: new Date()
      }
    });

    // Log the status change
    await logger.info(
      `Escalation ${escalation_id} status changed to ${status}`,
      'escalation_update',
      {
        escalation_id,
        old_status: escalation.status,
        new_status: status,
        resolved_by,
        resolution_notes
      }
    );

    // Send webhook notification
    try {
      const { notifyWebhook } = await import('../webhook/route');
      await notifyWebhook('escalation.updated', {
        escalation_id,
        old_status: escalation.status,
        new_status: status,
        resolved_by,
        resolution_notes
      });
    } catch (webhookError) {
      console.log('Webhook notification failed for escalation update:', webhookError);
    }

    return NextResponse.json({
      success: true,
      escalation: updatedEscalation,
      message: 'Escalation updated successfully'
    });

  } catch (error) {
    await logger.error('Error updating escalation', 'escalation_api', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to update escalation' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Utility functions for common escalation scenarios

// Flag low confidence content for human review
export async function flagLowConfidence(
  contentType: string,
  contentId: string,
  confidenceScore: number,
  context: any,
  suggestedActions: string[] = []
): Promise<string> {
  const priority = confidenceScore < 0.3 ? 'high' : confidenceScore < 0.5 ? 'medium' : 'low';
  
  return await createEscalationInternal(
    'low_confidence',
    priority,
    `Low confidence ${contentType} detected`,
    `Generated ${contentType} has confidence score of ${(confidenceScore * 100).toFixed(1)}% which is below acceptable threshold`,
    context,
    { [contentType === 'article' ? 'article_id' : 'job_id']: contentId },
    confidenceScore,
    undefined,
    suggestedActions.length > 0 ? suggestedActions : [
      'Review generated content for accuracy',
      'Consider regenerating with different parameters',
      'Add to training data if content is actually good'
    ]
  );
}

// Escalate system errors that need human attention
export async function escalateError(
  errorMessage: string,
  errorContext: string,
  errorDetails: any,
  relatedEntities?: EscalationItem['related_entities']
): Promise<string> {
  const priority = errorContext.includes('critical') || errorContext.includes('payment') ? 'critical' : 'high';
  
  return await createEscalationInternal(
    'error',
    priority,
    `System error requires attention: ${errorContext}`,
    errorMessage,
    { error_context: errorContext },
    relatedEntities,
    undefined,
    errorDetails,
    [
      'Check system logs for more details',
      'Verify external service availability',
      'Consider manual intervention if automated retry fails'
    ]
  );
}

// Flag content that needs quality review
export async function flagQualityReview(
  contentId: string,
  reason: string,
  context: any,
  priority: EscalationItem['priority'] = 'medium'
): Promise<string> {
  return await createEscalationInternal(
    'quality_concern',
    priority,
    `Content quality review required`,
    reason,
    context,
    { article_id: contentId },
    undefined,
    undefined,
    [
      'Review content for quality and accuracy',
      'Check if content meets publication standards',
      'Consider editorial improvements'
    ]
  );
}

// Export the utility functions for external use
export { createEscalationInternal as createEscalation }; 
