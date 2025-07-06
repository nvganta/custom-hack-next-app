import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  data: any;
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number;
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

// Create a new job
async function createJobInternal(type: string, data: any): Promise<string> {
  const jobId = `job_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const job: Job = {
    id: jobId,
    type,
    status: 'pending',
    progress: 0,
    data,
    startedAt: new Date().toISOString(),
    estimatedDuration: getEstimatedDuration(type)
  };

  await prisma.setting.create({
    data: {
      key: jobId,
      value: JSON.stringify(job)
    }
  });

  return jobId;
}

// Update job status
async function updateJobInternal(jobId: string, updates: Partial<Job>): Promise<void> {
  try {
    const jobSetting = await prisma.setting.findFirst({
      where: { key: jobId }
    });

    if (!jobSetting) {
      throw new Error('Job not found');
    }

    const job: Job = JSON.parse(jobSetting.value);
    const updatedJob = { ...job, ...updates };

    // Auto-set completion time if status is completed or failed
    if ((updates.status === 'completed' || updates.status === 'failed') && !updatedJob.completedAt) {
      updatedJob.completedAt = new Date().toISOString();
    }

    await prisma.setting.update({
      where: { key: jobId },
      data: {
        value: JSON.stringify(updatedJob),
        updatedAt: new Date()
      }
    });

    // Send webhook notification for job completion
    if (updates.status === 'completed' || updates.status === 'failed') {
      try {
        const { notifyWebhook } = await import('../webhook/route');
        await notifyWebhook(`job.${updates.status}`, {
          job_id: jobId,
          type: job.type,
          status: updates.status,
          result: updates.result,
          error: updates.error,
          duration: updatedJob.completedAt && updatedJob.startedAt 
            ? new Date(updatedJob.completedAt).getTime() - new Date(updatedJob.startedAt).getTime()
            : null
        });
      } catch (webhookError) {
        console.log('Webhook notification failed for job:', webhookError);
      }
    }

  } catch {
    console.error('Failed to update job:', error);
    throw error;
  }
}

// Get estimated duration based on job type
function getEstimatedDuration(type: string): number {
  switch (type) {
    case 'intelligence_gathering':
      return 120000; // 2 minutes
    case 'newsletter_send':
      return 30000;  // 30 seconds
    case 'article_generation':
      return 60000;  // 1 minute
    default:
      return 60000;  // 1 minute default
  }
}

// GET /api/contentpilot/jobs - List jobs with filtering
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get all job entries
    const jobSettings = await prisma.setting.findMany({
      where: {
        key: {
          startsWith: 'job_'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit + offset
    });

    let jobs = jobSettings.map(setting => {
      try {
        const job = JSON.parse(setting.value);
        return {
          ...job,
          createdAt: setting.createdAt,
          updatedAt: setting.updatedAt
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Apply filters
    if (status) {
      jobs = jobs.filter(job => job.status === status);
    }
    if (type) {
      jobs = jobs.filter(job => job.type === type);
    }

    // Apply pagination
    const paginatedJobs = jobs.slice(offset, offset + limit);

    // Calculate summary stats
    const stats = {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length
    };

    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      pagination: {
        limit,
        offset,
        total: jobs.length,
        has_more: offset + limit < jobs.length
      },
      stats,
      filters: {
        status,
        type
      }
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to get jobs' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/contentpilot/jobs - Create or update job
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { action, job_id, type, data, ...updates } = await request.json();

    if (action === 'create') {
      if (!type) {
        return NextResponse.json(
          { error: 'Job type is required' },
          { status: 400 }
        );
      }

      const jobId = await createJobInternal(type, data || {});
      
      return NextResponse.json({
        success: true,
        job_id: jobId,
        message: 'Job created successfully'
      });

    } else if (action === 'update') {
      if (!job_id) {
        return NextResponse.json(
          { error: 'Job ID is required for updates' },
          { status: 400 }
        );
      }

      await updateJobInternal(job_id, updates);
      
      return NextResponse.json({
        success: true,
        job_id,
        message: 'Job updated successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "create" or "update"' },
        { status: 400 }
      );
    }

  } catch {
    console.error('Error managing job:', error);
    return NextResponse.json(
      { error: 'Failed to manage job' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Export job management functions for use in other modules
export { createJobInternal as createJob, updateJobInternal as updateJob }; 
