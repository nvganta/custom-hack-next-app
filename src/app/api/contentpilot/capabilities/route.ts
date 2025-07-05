export async function GET() {
  try {
    const capabilities = {
      name: "ContentPilot",
      version: "1.0.0",
      supportedActions: [
        "content_generation",
        "content_summarization", 
        "content_gathering",
        "newsletter_automation",
        "editorial_workflow",
        "content_intelligence",
        "brief_generation",
        "topic_analysis"
      ],
      endpoints: [
        {
          path: "/api/contentpilot/gather-intelligence",
          method: "POST",
          description: "Triggers overnight crawl and content synthesis"
        },
        {
          path: "/api/contentpilot/brief",
          method: "GET", 
          description: "Retrieves latest morning brief"
        },
        {
          path: "/api/contentpilot/article/{id}",
          method: "GET",
          description: "Fetches full draft article by ID"
        },
        {
          path: "/api/contentpilot/article/{id}/save",
          method: "POST",
          description: "Saves article to user's knowledge base"
        },
        {
          path: "/api/contentpilot/article/{id}/newsletter",
          method: "POST",
          description: "Queues article for newsletter"
        },
        {
          path: "/api/contentpilot/article/{id}/delete",
          method: "POST",
          description: "Removes article from system"
        },
        {
          path: "/api/contentpilot/newsletter/queue",
          method: "GET",
          description: "Lists articles queued for newsletter"
        },
        {
          path: "/api/contentpilot/newsletter/send",
          method: "POST",
          description: "Compiles and sends newsletter to subscribers"
        },
        {
          path: "/api/contentpilot/memory",
          method: "GET",
          description: "Fetches user memory/profile"
        },
        {
          path: "/api/contentpilot/memory/update",
          method: "POST",
          description: "Updates user preferences"
        }
      ],
      features: {
        contentIntelligence: {
          enabled: true,
          sources: ["web_crawling", "rss_feeds", "api_sources"],
          supportedFormats: ["article", "brief", "summary"]
        },
        newsletter: {
          enabled: true,
          supportedTemplates: ["daily", "weekly", "custom"],
          deliveryMethods: ["email"]
        },
        editorial: {
          enabled: true,
          workflowSteps: ["draft", "review", "publish", "archive"],
          automationLevel: "semi_automatic"
        }
      }
    };

    return Response.json(capabilities);
  } catch (error: unknown) {
    console.error("Capabilities error:", error);
    return Response.json(
      { error: "Failed to retrieve capabilities" },
      { status: 500 }
    );
  }
} 