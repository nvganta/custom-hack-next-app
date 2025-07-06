import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Article {
  id: string;
  title: string;
  content: string;
  topics: string[];
  status: string;
  createdAt: string;
}

interface IntelligenceSummary {
  totalArticles: number;
  articles: Article[];
  topics: string[];
  date: string;
}

export async function POST(request: NextRequest) {
  try {
    const { summary, userEmail } = await request.json();
    
    if (!userEmail || !summary) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail and summary' },
        { status: 400 }
      );
    }

    // Generate one-liners for each article
    const articleOneLiners = summary.articles.map((article: Article) => {
      const oneLiner = generateOneLiner(article);
      return {
        ...article,
        oneLiner
      };
    });

    // Create email content
    const emailSubject = `🤖 ContentPilot Intelligence Report - ${summary.totalArticles} New Articles`;
    const emailHtml = createIntelligenceSummaryEmailHtml(summary, articleOneLiners);
    const emailText = createIntelligenceSummaryEmailText(summary, articleOneLiners);

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
      message: 'Intelligence summary sent successfully',
      emailId: emailResult.data?.id,
      articlesProcessed: summary.totalArticles,
    });

  } catch {
    console.error('Error sending intelligence summary:', error);
    return NextResponse.json(
      { error: 'Failed to send intelligence summary' },
      { status: 500 }
    );
  }
}

function generateOneLiner(article: Article): string {
  // Extract first sentence or create a concise summary
  const content = article.content || article.title;
  const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  
  if (sentences.length > 0 && sentences[0].length <= 120) {
    return sentences[0].trim() + '.';
  } else if (sentences.length > 0) {
    // Truncate long sentences
    const truncated = sentences[0].substring(0, 117).trim();
    return truncated + '...';
  } else {
    // Fallback: create summary from title and topics
    const topics = article.topics?.slice(0, 2).join(', ') || 'General';
    return `New insights on ${topics}: ${article.title.substring(0, 80)}${article.title.length > 80 ? '...' : ''}`;
  }
}

function createIntelligenceSummaryEmailHtml(summary: IntelligenceSummary, articles: any[]): string {
  const articlesHtml = articles.map((article, index) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 16px 8px; vertical-align: top; width: 40px;">
        <div style="width: 32px; height: 32px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
          ${index + 1}
        </div>
      </td>
      <td style="padding: 16px 8px;">
        <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
          ${article.title}
        </h4>
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
          ${article.oneLiner}
        </p>
        <div style="margin-bottom: 12px;">
          ${article.topics.slice(0, 3).map((topic: string) => 
            `<span style="display: inline-block; background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px;">#${topic}</span>`
          ).join('')}
        </div>
        <a href="http://localhost:3000/contentpilot/articles?articleId=${article.id}" 
           style="color: #3b82f6; text-decoration: none; font-weight: 500; font-size: 14px;">
          📖 Read Full Article →
        </a>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ContentPilot Intelligence Report</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🤖 ContentPilot AI</h1>
        <p style="color: #e5e7eb; margin: 8px 0 0 0; font-size: 16px;">Intelligence Report</p>
      </div>
      
      <!-- Summary Stats -->
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
        <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">📊 Intelligence Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-top: 16px;">
          <div style="text-align: center; padding: 12px; background: white; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${summary.totalArticles}</div>
            <div style="font-size: 12px; color: #6b7280;">Articles Found</div>
          </div>
          <div style="text-align: center; padding: 12px; background: white; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #10b981;">${summary.topics.length}</div>
            <div style="font-size: 12px; color: #6b7280;">Topics Covered</div>
          </div>
          <div style="text-align: center; padding: 12px; background: white; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">📅</div>
            <div style="font-size: 12px; color: #6b7280;">${new Date(summary.date).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <!-- Articles List -->
      <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #f9fafb; padding: 16px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; color: #1f2937; font-size: 18px;">📄 Article Highlights</h3>
          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">One-line summaries with quick access links</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
          ${articlesHtml}
        </table>
      </div>

      <!-- Navigation -->
      <div style="margin-top: 24px; padding: 20px; background: #f3f4f6; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">Ready to dive deeper?</p>
        <a href="http://localhost:3000/contentpilot/articles" 
           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 12px;">
          📚 View All Articles
        </a>
        <a href="http://localhost:3000/contentpilot/newsletter" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          📬 Create Newsletter
        </a>
      </div>

      <!-- Footer -->
      <div style="margin-top: 24px; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">This intelligence report was generated by your ContentPilot AI Mini Agent</p>
        <p style="margin: 4px 0 0 0;">Autonomous Content Intelligence • Reporting to Central Agent</p>
      </div>
    </body>
    </html>
  `;
}

function createIntelligenceSummaryEmailText(summary: IntelligenceSummary, articles: any[]): string {
  const articlesText = articles.map((article, index) => `
${index + 1}. ${article.title}
   ${article.oneLiner}
   Topics: ${article.topics.slice(0, 3).join(', ')}
   Read more: http://localhost:3000/contentpilot/articles?articleId=${article.id}
  `).join('\n');

  return `
ContentPilot AI - Intelligence Report

SUMMARY:
- ${summary.totalArticles} new articles found
- ${summary.topics.length} topics covered  
- Date: ${new Date(summary.date).toLocaleDateString()}

ARTICLE HIGHLIGHTS:
${articlesText}

QUICK ACTIONS:
- View all articles: http://localhost:3000/contentpilot/articles
- Create newsletter: http://localhost:3000/contentpilot/newsletter

---
This intelligence report was generated by your ContentPilot AI Mini Agent
Autonomous Content Intelligence • Reporting to Central Agent
  `.trim();
} 
