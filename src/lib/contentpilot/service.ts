export class ContentPilotService {
  private static instance: ContentPilotService;
  
  public static getInstance(): ContentPilotService {
    if (!ContentPilotService.instance) {
      ContentPilotService.instance = new ContentPilotService();
    }
    return ContentPilotService.instance;
  }

  // Register the ContentPilot agent
  async registerAgent() {
    try {
      const response = await fetch('/api/contentpilot/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: "ContentPilot",
          endpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contentpilot`,
          version: "1.0.0",
          capabilities: [
            "content_generation",
            "content_summarization", 
            "content_gathering",
            "newsletter_automation",
            "editorial_workflow",
            "content_intelligence",
            "brief_generation",
            "topic_analysis"
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to register ContentPilot agent:', error);
      throw error;
    }
  }



  // Trigger intelligence gathering
  async triggerIntelligenceGathering(options: {
    focusTopics?: string[];
    preferredSources?: string[];
    userId?: string;
  } = {}) {
    try {
      const response = await fetch('/api/contentpilot/gather-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Intelligence gathering failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to trigger intelligence gathering:', error);
      throw error;
    }
  }

  // Get latest brief
  async getLatestBrief(date?: string) {
    try {
      const url = new URL('/api/contentpilot/brief', window.location.origin);
      if (date) url.searchParams.set('date', date);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Brief retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get latest brief:', error);
      throw error;
    }
  }

  // Get all user-managed topics
  async getTopics() {
    try {
      const response = await fetch('/api/contentpilot/topics');
      if (!response.ok) {
        throw new Error(`Topic retrieval failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get topics:', error);
      throw error;
    }
  }

  // Create a new topic
  async createTopic(name: string) {
    try {
      const response = await fetch('/api/contentpilot/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Topic creation failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to create topic:', error);
      throw error;
    }
  }

  // Delete a topic
  async deleteTopic(topicId: string) {
    try {
      const response = await fetch(`/api/contentpilot/topics/${topicId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Topic deletion failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to delete topic:', error);
      throw error;
    }
  }

  // Get all content sources
  async getSources() {
    try {
      const response = await fetch('/api/contentpilot/sources');
      if (!response.ok) {
        throw new Error(`Source retrieval failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get sources:', error);
      throw error;
    }
  }

  // Create a new source
  async createSource(source: { name: string, url: string, type: 'RSS' | 'URL' | 'API' }) {
    try {
      const response = await fetch('/api/contentpilot/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Source creation failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to create source:', error);
      throw error;
    }
  }

  // Delete a source
  async deleteSource(sourceId: string) {
    try {
      const response = await fetch(`/api/contentpilot/sources/${sourceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Source deletion failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to delete source:', error);
      throw error;
    }
  }

  // Get a specific setting by key
  async getSetting(key: string) {
    try {
      const response = await fetch(`/api/contentpilot/settings?key=${key}`);
      if (!response.ok) {
        throw new Error(`Setting retrieval failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      throw error;
    }
  }

  // Save a setting
  async saveSetting(key: string, value: string) {
    try {
      const response = await fetch('/api/contentpilot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Setting save failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }

  // Get all subscribers
  async getSubscribers() {
    try {
      const response = await fetch('/api/contentpilot/subscribers');
      if (!response.ok) {
        throw new Error(`Subscriber retrieval failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get subscribers:', error);
      throw error;
    }
  }

  // Get article by ID
  async getArticle(articleId: string) {
    try {
      const response = await fetch(`/api/contentpilot/article/${articleId}`);
      
      if (!response.ok) {
        throw new Error(`Article retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get article:', error);
      throw error;
    }
  }

  // Save article
  async saveArticle(articleId: string, options: {
    userId?: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  } = {}) {
    try {
      const response = await fetch(`/api/contentpilot/article/${articleId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Article save failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to save article:', error);
      throw error;
    }
  }

  // Queue article for newsletter
  async queueForNewsletter(articleId: string, options: {
    action?: 'ADD' | 'REMOVE';
    newsletterId?: string;
    priority?: number;
  } = {}) {
    try {
      const response = await fetch(`/api/contentpilot/article/${articleId}/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Newsletter queue failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to queue for newsletter:', error);
      throw error;
    }
  }

  // Send newsletter
  async sendNewsletter(options: {
    newsletterId?: string;
    title?: string;
    subject?: string;
    testMode?: boolean;
    testEmail?: string;
    scheduleAt?: string;
  } = {}) {
    try {
      const response = await fetch('/api/contentpilot/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Newsletter send failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send newsletter:', error);
      throw error;
    }
  }

  // Get newsletter queue
  async getNewsletterQueue(options: {
    newsletterId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const url = new URL('/api/contentpilot/newsletter/queue', window.location.origin);
      if (options.newsletterId) url.searchParams.set('newsletterId', options.newsletterId);
      if (options.limit) url.searchParams.set('limit', options.limit.toString());
      if (options.offset) url.searchParams.set('offset', options.offset.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Newsletter queue retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get newsletter queue:', error);
      throw error;
    }
  }

  // Get user memory/preferences
  async getUserMemory(userId: string) {
    try {
      const url = new URL('/api/contentpilot/memory', window.location.origin);
      url.searchParams.set('userId', userId);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Memory retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user memory:', error);
      throw error;
    }
  }

  // Update user preferences
  async updateUserPreferences(userId: string, preferences: {
    focusTopics?: string[];
    preferredSources?: string[];
    editorialStyle?: string;
    notificationSettings?: {
      dailyBrief?: boolean;
      newsletterUpdates?: boolean;
      contentAlerts?: boolean;
      frequency?: 'DAILY' | 'WEEKLY' | 'NEVER';
    };
  }) {
    try {
      const response = await fetch('/api/contentpilot/memory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...preferences }),
      });

      if (!response.ok) {
        throw new Error(`Preferences update failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch('/api/contentpilot/health');
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Get capabilities
  async getCapabilities() {
    try {
      const response = await fetch('/api/contentpilot/capabilities');
      return await response.json();
    } catch (error) {
      console.error('Failed to get capabilities:', error);
      throw error;
    }
  }
} 