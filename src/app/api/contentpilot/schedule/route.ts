import { NextRequest, NextResponse } from 'next/server';
import { ContentPilotService } from '@/lib/contentpilot/service';

export async function POST(request: NextRequest) {
  try {
    const { schedule, enabled } = await request.json();
    
    const service = ContentPilotService.getInstance();
    
    // Save schedule configuration
    await service.saveSetting('automation_schedule', schedule);
    await service.saveSetting('automation_enabled', enabled.toString());
    
    return NextResponse.json({ 
      success: true, 
      message: 'Automation schedule updated',
      schedule,
      enabled 
    });
  } catch (error) {
    console.error('Error updating automation schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update automation schedule' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const service = ContentPilotService.getInstance();
    
    const schedule = await service.getSetting('automation_schedule') || '0 8 * * *'; // Default: 8 AM daily
    const enabled = (await service.getSetting('automation_enabled')) === 'true';
    
    return NextResponse.json({
      schedule,
      enabled,
      nextRun: getNextRunTime(schedule, enabled)
    });
  } catch (error) {
    console.error('Error fetching automation schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation schedule' },
      { status: 500 }
    );
  }
}

function getNextRunTime(cronExpression: string, enabled: boolean): string | null {
  if (!enabled) return null;
  
  // Simple cron parser for common patterns
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return null;
  
  const [minute, hour, day, month, dayOfWeek] = parts;
  
  const now = new Date();
  const next = new Date();
  
  // For daily schedule (0 8 * * *)
  if (day === '*' && month === '*' && dayOfWeek === '*') {
    next.setHours(parseInt(hour), parseInt(minute), 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }
  
  // For other patterns, return approximate next run
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
} 