interface Article {
  id: string;
  title: string;
  tldr: string;
  content: string;
  sourceUrl?: string;
  sourceName?: string;
  topics: string[];
}

interface NewsletterData {
  title: string;
  articles: Article[];
  unsubscribeUrl?: string;
  brandName?: string;
  date: string;
}

export function generateNewsletterHTML(data: NewsletterData): string {
  const { title, articles, unsubscribeUrl, brandName = "ContentPilot", date } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #334155;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 32px 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 32px 24px;
        }
        .article {
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
        }
        .article:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        .article-title {
            font-size: 20px;
            font-weight: 600;
            color: #1e293b;
            margin: 0 0 12px 0;
            line-height: 1.3;
        }
        .article-title a {
            color: inherit;
            text-decoration: none;
        }
        .article-title a:hover {
            color: #3b82f6;
        }
        .article-tldr {
            background-color: #f1f5f9;
            padding: 16px;
            border-radius: 6px;
            margin: 12px 0;
            font-style: italic;
            color: #475569;
            border-left: 4px solid #3b82f6;
        }
        .article-content {
            color: #475569;
            line-height: 1.7;
        }
        .article-meta {
            margin-top: 12px;
            font-size: 14px;
            color: #64748b;
        }
        .topics {
            margin-top: 8px;
        }
        .topic-tag {
            display: inline-block;
            background-color: #e0e7ff;
            color: #3730a3;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-right: 6px;
            margin-bottom: 4px;
        }
        .footer {
            background-color: #f8fafc;
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #64748b;
        }
        .footer a {
            color: #3b82f6;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #e2e8f0, transparent);
            margin: 24px 0;
        }
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content, .footer {
                padding: 24px 16px;
            }
            .article-title {
                font-size: 18px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <p>${brandName} • ${date}</p>
        </div>
        
        <div class="content">
            ${articles.map(article => `
                <div class="article">
                    <h2 class="article-title">
                        ${article.sourceUrl ? `<a href="${article.sourceUrl}" target="_blank">${article.title}</a>` : article.title}
                    </h2>
                    
                    ${article.tldr ? `
                        <div class="article-tldr">
                            <strong>TL;DR:</strong> ${article.tldr}
                        </div>
                    ` : ''}
                    
                    <div class="article-content">
                        ${article.content.split('\n').map(paragraph => 
                            paragraph.trim() ? `<p>${paragraph.trim()}</p>` : ''
                        ).join('')}
                    </div>
                    
                    <div class="article-meta">
                        ${article.sourceName ? `<div>Source: ${article.sourceName}</div>` : ''}
                        ${article.topics.length > 0 ? `
                            <div class="topics">
                                ${article.topics.map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>This newsletter was generated by ${brandName}</p>
            <p>
                <a href="https://contentpilot.ai" target="_blank">Learn more about ContentPilot</a>
                ${unsubscribeUrl ? ` • <a href="${unsubscribeUrl}" target="_blank">Unsubscribe</a>` : ''}
            </p>
        </div>
    </div>
</body>
</html>`;
}

export function generateNewsletterText(data: NewsletterData): string {
  const { title, articles, brandName = "ContentPilot", date } = data;

  return `
${title}
${brandName} • ${date}

${articles.map(article => `
${article.title}
${'='.repeat(article.title.length)}

${article.tldr ? `TL;DR: ${article.tldr}\n` : ''}

${article.content}

${article.sourceName ? `Source: ${article.sourceName}` : ''}
${article.topics.length > 0 ? `Topics: ${article.topics.join(', ')}` : ''}

---
`).join('\n')}

This newsletter was generated by ${brandName}
Learn more: https://contentpilot.ai
`.trim();
} 