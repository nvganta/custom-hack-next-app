import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Remove unused interface
// interface ArticleNotification {
//   title: string;
//   content: string;
//   tldr: string;
//   articleId: string;
// }

export async function POST(request: NextRequest) {
  try {
    const { article, userEmail } = await request.json();
    
    if (!userEmail || !article) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail and article' },
        { status: 400 }
      );
    }

    // Generate 1-2 line summary from article content
    const summary = generateArticleSummary(article);
    
    // Create email content
    const emailSubject = `📰 New Article Draft: ${article.title}`;
    const emailHtml = createNotificationEmailHtml(article, summary);
    const emailText = createNotificationEmailText(article, summary);

    // Send email via Resend
    const emailResult = await resend.emails.send({
      from: 'ContentPilot <onboarding@resend.dev>',
      to: [userEmail],
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      emailId: emailResult.data?.id,
      summary
    });

  } catch {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

function generateArticleSummary(article: any): string {
  // Extract first 2 sentences or create summary from title and content
  const content = article.content || '';
  const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  
  if (sentences.length >= 2) {
    return sentences.slice(0, 2).join('. ') + '.';
  } else if (sentences.length === 1) {
    return sentences[0] + '.';
  } else {
    // Fallback: create summary from title and topics
    const topics = article.topics?.join(', ') || 'General';
    return `New article about ${topics}: ${article.title}. Ready for review and publishing.`;
  }
}

function createNotificationEmailHtml(article: any, summary: string): string {
  const topicsHtml = article.topics?.map((topic: string) => 
    `<span style="background: #e5e7eb; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px;">${topic}</span>`
  ).join('') || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ContentPilot Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📰 ContentPilot AI</h1>
        <p style="color: #e5e7eb; margin: 5px 0 0 0;">Intelligence System Notification</p>
      </div>
      
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
        <h2 style="color: #374151; margin-top: 0;">New Article Draft Created</h2>
        
        <div style="margin: 15px 0;">
          <h3 style="color: #1f2937; margin-bottom: 8px;">${article.title}</h3>
          <p style="color: #6b7280; font-style: italic; margin: 8px 0;">${summary}</p>
        </div>
        
        <div style="margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Status:</strong> 
            <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${article.status || 'DRAFT'}</span>
          </p>
          <p style="margin: 5px 0;"><strong>Topics:</strong> ${topicsHtml}</p>
          <p style="margin: 5px 0;"><strong>Created:</strong> ${new Date(article.createdAt || Date.now()).toLocaleDateString()}</p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <a href="http://localhost:3000/contentpilot/articles" 
             style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Review Article →
          </a>
        </div>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 6px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">This is an automated notification from your ContentPilot AI Intelligence System.</p>
        <p style="margin: 5px 0 0 0;">Mini Agent reporting to Central Agent • Autonomous Content Intelligence</p>
      </div>
    </body>
    </html>
  `;
}

function createNotificationEmailText(article: any, summary: string): string {
  const topics = article.topics?.join(', ') || 'General';
  
  return `
ContentPilot AI - New Article Draft Created

Title: ${article.title}
Summary: ${summary}

Status: ${article.status || 'DRAFT'}
Topics: ${topics}
Created: ${new Date(article.createdAt || Date.now()).toLocaleDateString()}

Review your article at: http://localhost:3000/contentpilot/articles

---
This is an automated notification from your ContentPilot AI Intelligence System.
Mini Agent reporting to Central Agent • Autonomous Content Intelligence
  `.trim();
} 
