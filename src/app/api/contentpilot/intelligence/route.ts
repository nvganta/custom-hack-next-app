import { createJob, updateJob } from '../jobs/route';
import { logger } from '@/lib/logger';
import { notifyWebhook } from '../webhook/route';
import { flagLowConfidence, escalateError } from '../escalation/route';
import { firecrawlClient, openaiClient, withRetry } from '@/lib/resilience';

export async function POST(request: NextRequest) {
  let jobId: string | null = null;
  
  try {
    // Create job for tracking
    jobId = await createJob('intelligence_gathering', {
      sources: [],
      topics: [],
      limit: 2,
      requestId: Math.random().toString(36).substr(2, 9)
    });

    await logger.info(
      'Intelligence gathering started',
      'intelligence',
      { job_id: jobId },
      jobId
    );

    // Update job to running status
    await updateJob(jobId, { 
      status: 'running',
      progress: 10
    });

    // Send webhook notification
    await notifyWebhook('intelligence.started', {
      job_id: jobId,
      started_at: new Date().toISOString(),
      estimated_duration: 120000 // 2 minutes
    });

    // Create intelligence briefing record
    const _briefing = await prisma.intelligence_briefing.create({
      data: {
        date: today,
        status: 'PROCESSING',
        articlesGenerated: 0,
        topicsGathered: [],
      },
    });

    // Update job progress
    await updateJob(jobId, { progress: 20 });

    // ... existing source fetching code ...
    const sources = await prisma.content_source.findMany({
      where: { isActive: true },
      take: 5,
    });

    if (sources.length === 0) {
      await logger.warn(
        'No active content sources found',
        'intelligence',
        { job_id: jobId }
      );
      
      await escalateError(
        'No active content sources configured',
        'intelligence_gathering',
        { job_id: jobId, briefing_id: _briefing.id },
        { job_id: jobId }
      );
    }

    // Update job progress
    await updateJob(jobId, { progress: 30 });

    const articlesCreated = [];
    let totalProcessed = 0;

    for (const [index, source] of sources.entries()) {
      try {
        await logger.debug(
          `Processing source: ${source.name}`,
          'intelligence',
          { source_id: source.id, source_url: source.url, job_id: jobId }
        );

        // Update progress based on source processing
        const sourceProgress = 30 + (index / sources.length) * 50;
        await updateJob(jobId, { progress: Math.round(sourceProgress) });

        // Use resilient Firecrawl client
        const crawlResult = await withRetry(
          () => firecrawlClient.crawlUrl(source.url, {
            crawlerOptions: {
              includes: [],
              excludes: [],
              generateImgAltText: true,
              returnOnlyUrls: false,
            },
            pageOptions: {
              onlyMainContent: true,
            },
          }),
          {
            maxAttempts: 2,
            baseDelay: 2000,
            retryCondition: (error) => {
              // Don't retry on 4xx errors (likely API key or quota issues)
              return !(error.response && error.response.status >= 400 && error.response.status < 500);
            }
          },
          `Firecrawl ${source.name}`
        );

        if (!crawlResult.success) {
          await logger.warn(
            `Firecrawl failed for source: ${source.name}`,
            'intelligence',
            { 
              source_id: source.id, 
              error: crawlResult.error,
              job_id: jobId 
            }
          );
          continue;
        }

        totalProcessed++;

        // ... existing content processing and article generation ...
        const crawledData = crawlResult.data;
        if (!crawledData || crawledData.length === 0) {
          await logger.info(
            `No content found for source: ${source.name}`,
            'intelligence',
            { source_id: source.id, job_id: jobId }
          );
          continue;
        }

        // Take first article for processing
        const firstArticle = crawledData[0];
        const content = firstArticle.markdown || firstArticle.content || '';

        if (content.length < 100) {
          await logger.warn(
            `Insufficient content from source: ${source.name}`,
            'intelligence',
            { 
              source_id: source.id, 
              content_length: content.length,
              job_id: jobId 
            }
          );
          continue;
        }

        // Generate article using resilient OpenAI client
        const generatedContent = await withRetry(
          () => openaiClient.createCompletion(
            `Based on the following content, create a comprehensive, well-structured article...`,
            {
              max_tokens: 6000,
              temperature: 0.7,
            }
          ),
          {
            maxAttempts: 3,
            baseDelay: 1000,
            retryCondition: (error) => {
              return error.response && (
                error.response.status === 429 || // Rate limit
                error.response.status >= 500     // Server errors
              );
            }
          },
          `OpenAI article generation for ${source.name}`
        );

        const generatedText = generatedContent.choices[0]?.message?.content;
        if (!generatedText) {
          await logger.error(
            `Failed to generate content for source: ${source.name}`,
            'intelligence',
            { source_id: source.id, job_id: jobId }
          );
          continue;
        }

        // Parse the generated content...
        const lines = generatedText.trim().split('\n').filter(line => line.trim());
        const title = lines.find(line => line.startsWith('Title:'))?.replace('Title:', '').trim() || 'Generated Article';
        const tldr = lines.find(line => line.startsWith('TL;DR:'))?.replace('TL;DR:', '').trim() || 'Summary not available';
        const topicsLine = lines.find(line => line.startsWith('Topics:'));
        const topics = topicsLine ? topicsLine.replace('Topics:', '').split(',').map(t => t.trim()) : ['General'];
        
        const contentStartIndex = lines.findIndex(line => line.startsWith('Content:'));
        const articleContent = contentStartIndex >= 0 
          ? lines.slice(contentStartIndex + 1).join('\n').trim()
          : generatedText;

        // Calculate confidence score based on content quality
        const confidenceScore = calculateContentConfidence(title, articleContent, tldr, topics);
        
        // Create the article
        const newArticle = await prisma.article.create({
          data: {
            title,
            content: articleContent,
            tldr,
            topics,
            status: 'DRAFT',
            sourceUrl: source.url,
            sourceName: source.name,
            inNewsletterQueue: false,
          },
        });

        articlesCreated.push(newArticle);

        await logger.info(
          `Article created: ${title}`,
          'intelligence',
          {
            article_id: newArticle.id,
            source_id: source.id,
            confidence_score: confidenceScore,
            job_id: jobId
          }
        );

        // Flag low confidence articles for human review
        if (confidenceScore < 0.6) {
          await flagLowConfidence(
            'article',
            newArticle.id,
            confidenceScore,
            {
              title,
              source: source.name,
              generated_by: 'intelligence_gathering',
              job_id: jobId
            },
            [
              'Review article content for accuracy and quality',
              'Consider regenerating with different parameters',
              'Verify source content was properly processed'
            ]
          );
        }

        // Send webhook for article creation
        await notifyWebhook('article.created', {
          article_id: newArticle.id,
          title,
          confidence_score: confidenceScore,
          source: source.name,
          job_id: jobId
        });

      } catch (sourceError) {
        await logger.error(
          `Error processing source: ${source.name}`,
          'intelligence',
          { 
            source_id: source.id, 
            source_url: source.url,
            job_id: jobId 
          },
          sourceError as Error
        );

        // Escalate critical errors
        await escalateError(
          `Failed to process content source: ${source.name}`,
          'intelligence_gathering',
          {
            source_id: source.id,
            source_url: source.url,
            error: sourceError instanceof Error ? sourceError.message : String(sourceError),
            job_id: jobId
          },
          { job_id: jobId }
        );
      }
    }

    // Update briefing with results
    const updatedBriefing = await prisma.intelligence_briefing.update({
      where: { id: _briefing.id },
      data: {
        status: 'READY',
        articlesGenerated: articlesCreated.length,
        topicsGathered: [...new Set(articlesCreated.flatMap(a => a.topics))],
      },
    });

    // Update job to completed
    await updateJob(jobId, { 
      status: 'completed',
      progress: 100,
      result: {
        briefing_id: _briefing.id,
        articles_created: articlesCreated.length,
        sources_processed: totalProcessed,
        topics_gathered: updatedBriefing.topicsGathered.length
      }
    });

    await logger.info(
      'Intelligence gathering completed successfully',
      'intelligence',
      {
        briefing_id: _briefing.id,
        articles_created: articlesCreated.length,
        sources_processed: totalProcessed,
        job_id: jobId
      }
    );

    // Send completion webhook
    await notifyWebhook('intelligence.completed', {
      job_id: jobId,
      briefing_id: _briefing.id,
      articles_created: articlesCreated.length,
      sources_processed: totalProcessed,
      topics_gathered: updatedBriefing.topicsGathered,
      completed_at: new Date().toISOString()
    });

    // Send email summary if requested (existing code)
    try {
      const emailResponse = await fetch(`${request.nextUrl.origin}/api/contentpilot/intelligence-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefingId: _briefing.id,
          articles: articlesCreated,
          jobId
        }),
      });

      if (!emailResponse.ok) {
        await logger.warn(
          'Failed to send intelligence summary email',
          'intelligence',
          { briefing_id: _briefing.id, job_id: jobId }
        );
      }
    } catch (emailError) {
      await logger.warn(
        'Error sending intelligence summary email',
        'intelligence',
        { briefing_id: _briefing.id, job_id: jobId },
        emailError as Error
      );
    }

    return NextResponse.json({
      success: true,
      briefingId: _briefing.id,
      articlesCreated: articlesCreated.length,
      sourcesProcessed: totalProcessed,
      topicsGathered: updatedBriefing.topicsGathered,
      jobId,
      message: 'Intelligence gathering completed successfully',
    });

  } catch {
    // Update job to failed if we have a job ID
    if (jobId) {
      await updateJob(jobId, { 
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    await logger.error(
      'Intelligence gathering failed',
      'intelligence',
      { job_id: jobId },
      error as Error
    );

    // Send failure webhook
    if (jobId) {
      await notifyWebhook('intelligence.failed', {
        job_id: jobId,
        error: error instanceof Error ? error.message : String(error),
        failed_at: new Date().toISOString()
      });
    }

    // Escalate the error
    await escalateError(
      'Intelligence gathering process failed',
      'critical_system_error',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        job_id: jobId
      },
      { job_id: jobId }
    );

    console.error('Error during intelligence gathering:', error);
    return NextResponse.json(
      { error: 'Failed to gather intelligence' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to calculate content confidence score
function calculateContentConfidence(
  title: string, 
  content: string, 
  tldr: string, 
  topics: string[]
): number {
  let score = 0.5; // Base score

  // Title quality (0-0.2)
  if (title && title.length > 10 && title.length < 100) {
    score += 0.15;
  }
  if (title && !title.toLowerCase().includes('generated') && !title.toLowerCase().includes('untitled')) {
    score += 0.05;
  }

  // Content quality (0-0.4)
  if (content && content.length > 500) {
    score += 0.1;
  }
  if (content && content.length > 1000) {
    score += 0.1;
  }
  if (content && content.split('\n').length > 5) { // Multiple paragraphs
    score += 0.1;
  }
  if (content && /[.!?]\s+[A-Z]/.test(content)) { // Proper sentence structure
    score += 0.1;
  }

  // TL;DR quality (0-0.2)
  if (tldr && tldr.length > 20 && tldr.length < 200) {
    score += 0.1;
  }
  if (tldr && !tldr.toLowerCase().includes('summary not available')) {
    score += 0.1;
  }

  // Topics quality (0-0.1)
  if (topics && topics.length > 0 && !topics.includes('General')) {
    score += 0.1;
  }

  return Math.min(1.0, Math.max(0.0, score));
} 
