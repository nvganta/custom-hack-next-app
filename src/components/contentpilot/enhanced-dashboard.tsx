"use client";

import { useState, useEffect, useCallback } from "react";
import { ContentPilotService } from "@/lib/contentpilot/service";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import ReactMarkdown from "react-markdown";

interface Article {
  id: string;
  title: string;
  content?: string;
  tldr: string;
  topics: string[];
  source: {
    name: string;
    url: string;
  };
  status: string;
  inNewsletterQueue: boolean;
  createdAt: string;
  draftLink: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Brief {
  date: string;
  status: string;
  briefingId: string;
  summary: {
    totalArticles: number;
    uniqueTopics: number;
    sourcesUsed: number;
    articlesInQueue: number;
  };
  articles: Article[];
  topicGroups: Array<{
    topic: string;
    articleCount: number;
    articles: Array<{
      id: string;
      title: string;
      tldr: string;
    }>;
  }>;
}

interface FullArticle extends Article {
  content: string;
  updatedAt: string;
}

interface HealthStatus {
  status: string;
  [key: string]: unknown;
}

function formatDateGroup(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d, yyyy");
}

function groupArticlesByDate(articles: Article[]) {
  const groups: { [key: string]: Article[] } = {};
  
  articles.forEach(article => {
    const date = new Date(article.createdAt);
    const dateKey = format(startOfDay(date), "yyyy-MM-dd");
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(article);
  });

  const sortedGroups = Object.entries(groups)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([dateKey, articles]) => ({
      dateKey,
      date: new Date(dateKey),
      articles: articles.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }));

  return sortedGroups;
}

export default function EnhancedContentPilotDashboard() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<FullArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatheringIntelligence, setGatheringIntelligence] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'queued'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedTldr, setEditedTldr] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  const service = ContentPilotService.getInstance();

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [briefData, healthData] = await Promise.all([
        service.getLatestBrief(),
        service.healthCheck()
      ]);
      setBrief(briefData);
      setHealthStatus(healthData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedArticle) {
      setEditedTitle(selectedArticle.title);
      setEditedContent(selectedArticle.content || '');
      setEditedTldr(selectedArticle.tldr || '');
      setIsEditing(false);
      setPreviewMode(false);
    }
  }, [selectedArticle]);

  const loadFullArticle = async (article: Article) => {
    try {
      setArticleLoading(true);
      const response = await service.getArticle(article.id);
      setSelectedArticle(response.article);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setArticleLoading(false);
    }
  };

  const handleGatherIntelligence = async () => {
    try {
      setGatheringIntelligence(true);
      await service.triggerIntelligenceGathering({
        focusTopics: ["AI", "Technology", "Web Development"],
      });
      
      setTimeout(async () => {
        try {
          const briefData = await service.getLatestBrief();
          setBrief(briefData);
        } catch (err) {
          console.error('Failed to refresh brief:', err);
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to gather intelligence');
    } finally {
      setGatheringIntelligence(false);
    }
  };

  const handleToggleNewsletter = async (articleId: string, action: 'ADD' | 'REMOVE') => {
    try {
      await service.queueForNewsletter(articleId, { action });
      await loadInitialData();
      if (selectedArticle && selectedArticle.id === articleId) {
        await loadFullArticle(selectedArticle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update newsletter queue');
    }
  };

  const handleSaveArticle = async () => {
    if (!selectedArticle) return;
    
    setSaving(true);
    try {
      await service.saveArticle(selectedArticle.id, {
        status: 'PUBLISHED'
      });
      setIsEditing(false);
      await loadInitialData();
      await loadFullArticle(selectedArticle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const response = await fetch(`/api/contentpilot/article/${articleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete article');
      
      if (selectedArticle && selectedArticle.id === articleId) {
        setSelectedArticle(null);
      }
      await loadInitialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete article');
    }
  };

  // Filter articles
  const filteredArticles = brief?.articles.filter(article => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'draft' && article.status === 'DRAFT') ||
      (filter === 'published' && article.status === 'PUBLISHED') ||
      (filter === 'queued' && article.inNewsletterQueue);

    const matchesSearch = 
      searchTerm === '' ||
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.topics.some(topic => 
        topic.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      (article.source.name && 
        article.source.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  }) || [];

  const groupedArticles = groupArticlesByDate(filteredArticles);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800';
      case 'PUBLISHED': return 'bg-green-100 text-green-800';
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ContentPilot Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ContentPilot</h1>
              <p className="text-gray-600">AI-powered content intelligence and newsletter automation</p>
            </div>
            <div className="flex items-center space-x-3">
              {healthStatus && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  healthStatus.status === 'UP' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {healthStatus.status}
                </div>
              )}
              <button
                onClick={handleGatherIntelligence}
                disabled={gatheringIntelligence}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {gatheringIntelligence ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Gathering...</span>
                  </>
                ) : (
                  <span>Gather Intelligence</span>
                )}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {brief && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-gray-500">Total Articles</h3>
                <p className="text-lg font-bold text-gray-900">{brief.summary.totalArticles}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-gray-500">Unique Topics</h3>
                <p className="text-lg font-bold text-gray-900">{brief.summary.uniqueTopics}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-gray-500">Sources Used</h3>
                <p className="text-lg font-bold text-gray-900">{brief.summary.sourcesUsed}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-gray-500">Newsletter Queue</h3>
                <p className="text-lg font-bold text-gray-900">{brief.summary.articlesInQueue}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Article List */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          {/* Article List Header */}
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
              <div className="text-sm text-gray-500">
                {filteredArticles.length} of {brief?.articles.length || 0} articles
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex space-x-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'draft', label: 'Drafts' },
                { key: 'published', label: 'Published' },
                { key: 'queued', label: 'Queued' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as 'all' | 'draft' | 'published' | 'queued')}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    filter === key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Article Groups */}
          <div className="flex-1 overflow-y-auto">
            {groupedArticles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📄</div>
                <p>No articles found</p>
              </div>
            ) : (
              groupedArticles.map(({ dateKey, date, articles: groupArticles }) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900">
                      {formatDateGroup(date)}
                    </h3>
                  </div>

                  {/* Articles */}
                  <div className="divide-y divide-gray-100">
                    {groupArticles.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => loadFullArticle(article)}
                        className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedArticle?.id === article.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                        }`}
                      >
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                          {article.title}
                        </h4>
                        
                        {article.tldr && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                            {article.tldr}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(article.status)}`}>
                              {article.status}
                            </span>
                            
                            {article.inNewsletterQueue && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                Queued
                              </span>
                            )}
                          </div>

                          <span className="text-xs text-gray-500">
                            {format(new Date(article.createdAt), "h:mm a")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Article Editor */}
        <div className="flex-1 flex flex-col">
          {!selectedArticle ? (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Article</h3>
                <p className="text-gray-600">Choose an article from the list to view or edit it</p>
              </div>
            </div>
          ) : articleLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading article...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Article Header */}
              <div className="flex-shrink-0 border-b border-gray-200 bg-white">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <h1 className="text-xl font-semibold text-gray-900">
                        {isEditing ? 'Edit Article' : 'Article'}
                      </h1>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedArticle.status)}`}>
                          {selectedArticle.status}
                        </span>
                        {selectedArticle.inNewsletterQueue && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Queued for Newsletter
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {isEditing && (
                        <>
                          <button
                            onClick={() => setPreviewMode(!previewMode)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            {previewMode ? 'Edit' : 'Preview'}
                          </button>
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {!isEditing && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                    <span>Source: {selectedArticle.source.name}</span>
                    <span>•</span>
                    <span>Created: {format(new Date(selectedArticle.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleSaveArticle}
                        disabled={saving}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          saving
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {saving ? 'Saving...' : 'SAVE'}
                      </button>

                      <button
                        onClick={() => handleToggleNewsletter(
                          selectedArticle.id,
                          selectedArticle.inNewsletterQueue ? 'REMOVE' : 'ADD'
                        )}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          selectedArticle.inNewsletterQueue
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {selectedArticle.inNewsletterQueue ? 'REMOVE FROM NEWSLETTER' : 'ADD TO NEWSLETTER'}
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteArticle(selectedArticle.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              </div>

              {/* Article Content */}
              <div className="flex-1 overflow-hidden">
                {isEditing ? (
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">TL;DR Summary</label>
                        <textarea
                          value={editedTldr}
                          onChange={(e) => setEditedTldr(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Content (Markdown)</label>
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="max-w-none">
                      <h1 className="text-3xl font-bold text-gray-900 mb-4">{selectedArticle.title}</h1>
                      
                      {selectedArticle.tldr && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                          <p className="font-medium text-blue-900">TL;DR</p>
                          <p className="text-blue-800">{selectedArticle.tldr}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-6">
                        {selectedArticle.topics.map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>

                      <div className="prose max-w-none">
                        <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 