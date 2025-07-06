import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Validate API key
async function validateApiKey(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return { valid: false, error: 'API key required' };
    }

    // Validate API key against database
    const keyRecord = await prisma.api_key.findFirst({
      where: { 
        key: apiKey,
        isActive: true 
      }
    });

    if (!keyRecord) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Update last used timestamp
    await prisma.api_key.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() }
    });
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'API key validation failed' };
  }
}

// GET /api/contentpilot/jobs/[id] - Get specific job status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const jobId = params.id;

    const jobSetting = await prisma.setting.findFirst({
      where: { key: jobId }
    });

    if (!jobSetting) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const job = JSON.parse(jobSetting.value);
    
    // Calculate elapsed time and estimated remaining time
    const now = new Date();
    const startTime = job.startedAt ? new Date(job.startedAt) : now;
    const elapsedMs = now.getTime() - startTime.getTime();
    
    let estimatedRemaining = null;
    if (job.status === 'running' && job.estimatedDuration && job.progress > 0) {
      const estimatedTotal = (elapsedMs / job.progress) * 100;
      estimatedRemaining = Math.max(0, estimatedTotal - elapsedMs);
    }

    const response = {
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        data: job.data,
        result: job.result,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        estimatedDuration: job.estimatedDuration
      },
      timing: {
        elapsed_ms: elapsedMs,
        elapsed_human: formatDuration(elapsedMs),
        estimated_remaining_ms: estimatedRemaining,
        estimated_remaining_human: estimatedRemaining ? formatDuration(estimatedRemaining) : null,
        estimated_completion: estimatedRemaining ? new Date(now.getTime() + estimatedRemaining).toISOString() : null
      },
      metadata: {
        created_at: jobSetting.createdAt,
        updated_at: jobSetting.updatedAt,
        is_complete: ['completed', 'failed', 'cancelled'].includes(job.status),
        is_active: ['pending', 'running'].includes(job.status)
      }
    };

    return NextResponse.json(response);

  } catch {
    return NextResponse.json(
      { error: 'Failed to get job' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/contentpilot/jobs/[id] - Update specific job
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const jobId = params.id;
    const updates = await request.json();

    const jobSetting = await prisma.setting.findFirst({
      where: { key: jobId }
    });

    if (!jobSetting) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const job = JSON.parse(jobSetting.value);
    const updatedJob = { ...job, ...updates };

    // Auto-set completion time if status is completed or failed
    if ((updates.status === 'completed' || updates.status === 'failed') && !updatedJob.completedAt) {
      updatedJob.completedAt = new Date().toISOString();
    }

    // Set running start time if status changes to running
    if (updates.status === 'running' && job.status !== 'running') {
      updatedJob.startedAt = new Date().toISOString();
    }

    await prisma.setting.update({
      where: { key: jobId },
      data: {
        value: JSON.stringify(updatedJob),
        updatedAt: new Date()
      }
    });

    // Send webhook notification for status changes
    if (updates.status && updates.status !== job.status) {
      try {
        const { notifyWebhook } = await import('../../webhook/route');
        await notifyWebhook(`job.status_changed`, {
          job_id: jobId,
          type: job.type,
          old_status: job.status,
          new_status: updates.status,
          progress: updatedJob.progress,
          result: updatedJob.result,
          error: updatedJob.error
        });

        // Also send specific completion events
        if (updates.status === 'completed' || updates.status === 'failed') {
          await notifyWebhook(`job.${updates.status}`, {
            job_id: jobId,
            type: job.type,
            status: updates.status,
            result: updatedJob.result,
            error: updatedJob.error,
            duration: updatedJob.completedAt && updatedJob.startedAt 
              ? new Date(updatedJob.completedAt).getTime() - new Date(updatedJob.startedAt).getTime()
              : null
          });
        }
      } catch (webhookError) {
        console.log('Webhook notification failed for job update:', webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: 'Job updated successfully'
    });

  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/contentpilot/jobs/[id] - Cancel/delete job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const jobId = params.id;

    const jobSetting = await prisma.setting.findFirst({
      where: { key: jobId }
    });

    if (!jobSetting) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const job = JSON.parse(jobSetting.value);

    // If job is still running, mark as cancelled instead of deleting
    if (['pending', 'running'].includes(job.status)) {
      const cancelledJob = {
        ...job,
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        error: 'Job cancelled by user request'
      };

      await prisma.setting.update({
        where: { key: jobId },
        data: {
          value: JSON.stringify(cancelledJob),
          updatedAt: new Date()
        }
      });

      // Send webhook notification
      try {
        const { notifyWebhook } = await import('../../webhook/route');
        await notifyWebhook('job.cancelled', {
          job_id: jobId,
          type: job.type,
          cancelled_at: cancelledJob.completedAt
        });
      } catch (webhookError) {
        console.log('Webhook notification failed for job cancellation:', webhookError);
      }

      return NextResponse.json({
        success: true,
        message: 'Job cancelled successfully',
        job: cancelledJob
      });
    } else {
      // Job is completed/failed, safe to delete
      await prisma.setting.delete({
        where: { key: jobId }
      });

      return NextResponse.json({
        success: true,
        message: 'Job deleted successfully'
      });
    }

  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
} 