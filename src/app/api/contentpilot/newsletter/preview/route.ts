import { NextResponse } from 'next/server';
import { ContentPilotService } from '@/lib/contentpilot/service';
import { generateNewsletterHTML, generateNewsletterText } from '@/lib/contentpilot/email-templates';

export async function GET() {
  try {
    const service = ContentPilotService.getInstance();
    
    // Get articles in newsletter queue
    const articles = await service.getQueuedArticles();
    
    if (articles.length === 0) {
      return NextResponse.json({
        error: 'No articles in newsletter queue'
      }, { status: 400 });
    }

    // Generate preview content
    const htmlContent = generateNewsletterHTML(articles);
    const textContent = generateNewsletterText(articles);
    
    // Get subscriber count
    const subscribers = await service.getSubscribers();
    
    return NextResponse.json({
      success: true,
      preview: {
        html: htmlContent,
        text: textContent,
        articleCount: articles.length,
        subscriberCount: subscribers.length,
        estimatedSendTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating newsletter preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate newsletter preview' },
      { status: 500 }
    );
  }
} 