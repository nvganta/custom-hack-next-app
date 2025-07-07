import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to get base URL
function getBaseUrl(request?: NextRequest): string {
  if (request) {
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    return `${protocol}://${host}`;
  }
  
  return process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');
}

// Remove unused interface
// interface ArticleNotification {
//   title: string;
//   content: string;
//   tldr: string;
//   articleId: string;
// }

export async function POST(request: NextRequest) {
  try {
    const { type, data, userEmail } = await request.json();
    
    if (!type || !data || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data, and userEmail' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(request);
    let emailSubject = '';
    let emailHtml = '';
    let emailText = '';

    switch (type) {
      case 'article_ready':
        emailSubject = `📄 New Article Ready: ${data.title}`;
        emailHtml = createArticleReadyEmailHtml(data, baseUrl);
        emailText = createArticleReadyEmailText(data, baseUrl);
        break;
        
      case 'newsletter_sent':
        emailSubject = `📬 Newsletter Sent: ${data.title}`;
        emailHtml = createNewsletterSentEmailHtml(data, baseUrl);
        emailText = createNewsletterSentEmailText(data, baseUrl);
        break;
        
      case 'intelligence_complete':
        emailSubject = `🧠 Intelligence Gathering Complete - ${data.articlesGenerated} articles`;
        emailHtml = createIntelligenceCompleteEmailHtml(data, baseUrl);
        emailText = createIntelligenceCompleteEmailText(data, baseUrl);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    // Send email via Resend
    const emailResult = await resend.emails.send({
      from: 'ContentPilot AI <onboarding@resend.dev>',
      to: [userEmail],
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      emailId: emailResult.data?.id,
      type,
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

function createArticleReadyEmailHtml(data: any, baseUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Article Ready</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📄 New Article Ready</h1>
      </div>
      
      <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">${data.title}</h2>
        <p style="color: #6b7280; margin: 16px 0;">${data.tldr || 'New article has been generated and is ready for review.'}</p>
        
        <div style="margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
          <p style="margin: 0; color: #374151;"><strong>Status:</strong> ${data.status || 'Draft'}</p>
          <p style="margin: 8px 0 0 0; color: #374151;"><strong>Topics:</strong> ${data.topics?.join(', ') || 'General'}</p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${baseUrl}/contentpilot/articles" 
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            📖 Review Article
          </a>
        </div>
      </div>
      
      <div style="margin-top: 24px; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">ContentPilot AI - Autonomous Content Intelligence</p>
      </div>
    </body>
    </html>
  `;
}

function createArticleReadyEmailText(data: any, baseUrl: string): string {
  return `
New Article Ready: ${data.title}

${data.tldr || 'New article has been generated and is ready for review.'}

Status: ${data.status || 'Draft'}
Topics: ${data.topics?.join(', ') || 'General'}

Review your article at: ${baseUrl}/contentpilot/articles

---
ContentPilot AI - Autonomous Content Intelligence
  `.trim();
}

function createNewsletterSentEmailHtml(data: any, _baseUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Newsletter Sent</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📬 Newsletter Sent</h1>
      </div>
      
      <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">${data.title}</h2>
        <p style="color: #6b7280; margin: 16px 0;">Your newsletter has been successfully sent to all subscribers.</p>
        
        <div style="margin: 24px 0; padding: 16px; background: #f0fdf4; border-radius: 8px;">
          <p style="margin: 0; color: #374151;"><strong>Recipients:</strong> ${data.recipientCount || 'All subscribers'}</p>
          <p style="margin: 8px 0 0 0; color: #374151;"><strong>Articles Included:</strong> ${data.articleCount || 'Multiple'}</p>
        </div>
      </div>
      
      <div style="margin-top: 24px; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">ContentPilot AI - Autonomous Content Intelligence</p>
      </div>
    </body>
    </html>
  `;
}

function createNewsletterSentEmailText(data: any, _baseUrl: string): string {
  return `
Newsletter Sent: ${data.title}

Your newsletter has been successfully sent to all subscribers.

Recipients: ${data.recipientCount || 'All subscribers'}
Articles Included: ${data.articleCount || 'Multiple'}

---
ContentPilot AI - Autonomous Content Intelligence
  `.trim();
}

function createIntelligenceCompleteEmailHtml(data: any, baseUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Intelligence Gathering Complete</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🧠 Intelligence Complete</h1>
      </div>
      
      <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">Intelligence Gathering Complete</h2>
        <p style="color: #6b7280; margin: 16px 0;">Your ContentPilot agent has finished gathering intelligence and generating new articles.</p>
        
        <div style="margin: 24px 0; padding: 16px; background: #faf5ff; border-radius: 8px;">
          <p style="margin: 0; color: #374151;"><strong>Articles Generated:</strong> ${data.articlesGenerated || 0}</p>
          <p style="margin: 8px 0 0 0; color: #374151;"><strong>Topics Covered:</strong> ${data.topicsUsed || 'Multiple'}</p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${baseUrl}/contentpilot/articles" 
             style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 12px;">
            📄 View Articles
          </a>
          <a href="${baseUrl}/contentpilot/newsletter" 
             style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            📬 Create Newsletter
          </a>
        </div>
      </div>
      
      <div style="margin-top: 24px; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">ContentPilot AI - Autonomous Content Intelligence</p>
      </div>
    </body>
    </html>
  `;
}

function createIntelligenceCompleteEmailText(data: any, baseUrl: string): string {
  return `
Intelligence Gathering Complete

Your ContentPilot agent has finished gathering intelligence and generating new articles.

Articles Generated: ${data.articlesGenerated || 0}
Topics Covered: ${data.topicsUsed || 'Multiple'}

View Articles: ${baseUrl}/contentpilot/articles
Create Newsletter: ${baseUrl}/contentpilot/newsletter

---
ContentPilot AI - Autonomous Content Intelligence
  `.trim();
} 
