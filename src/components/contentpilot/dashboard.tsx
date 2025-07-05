"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { ContentPilotService } from "@/lib/contentpilot/service";
import { format } from "date-fns";
import SettingsPage from "./settings-page";
import AutomationSettings from "./automation-settings";

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

interface Topic {
  id: string;
  name: string;
}

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
}

interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
}

export default function ContentPilotDashboard() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<FullArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gatheringIntelligence, setGatheringIntelligence] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'articles' | 'newsletter' | 'topics' | 'sources' | 'settings' | 'automation'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);

  const [sources, setSources] = useState<Source[]>([]);
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'URL' as 'URL' | 'RSS' | 'API' });
  const [isSubmittingSource, setIsSubmittingSource] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ show: false, message: '', type: 'info' });

  const service = ContentPilotService.getInstance();

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 5000);
  };

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [briefData, topicsData, subscribersData, sourcesData] = await Promise.all([
        service.getLatestBrief(),
        service.getTopics(),
        service.getSubscribers(),
        service.getSources(),
      ]);
      setBrief(briefData);
      setTopics(topicsData);
      setSubscribers(subscribersData);
      setSources(sourcesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleCreateTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    setIsSubmittingTopic(true);
    try {
      const createdTopic = await service.createTopic(newTopic);
      setTopics([createdTopic, ...topics]);
      setNewTopic('');
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create topic");
    } finally {
      setIsSubmittingTopic(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) {
      return;
    }

    try {
      await service.deleteTopic(topicId);
      setTopics(topics.filter(topic => topic.id !== topicId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete topic");
    }
  };

  const handleCreateSource = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSource.name.trim() || !newSource.url.trim()) return;

    setIsSubmittingSource(true);
    try {
      const createdSource = await service.createSource(newSource);
      setSources([createdSource, ...sources]);
      setNewSource({ name: '', url: '', type: 'URL' });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create source");
    } finally {
      setIsSubmittingSource(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source?')) {
      return;
    }

    try {
      await service.deleteSource(sourceId);
      setSources(sources.filter(source => source.id !== sourceId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete source");
    }
  };

  const handleGatherIntelligence = async () => {
    try {
      setGatheringIntelligence(true);
      showToast('🔄 Starting intelligence gathering...', 'info');
      
      const response = await fetch('/api/contentpilot/gather-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to gather intelligence');
      }

      const result = await response.json();
      showToast(`✅ Successfully generated ${result.articlesGenerated} articles!`, 'success');
      await loadInitialData();
    } catch (error) {
      console.error('Error gathering intelligence:', error);
      showToast('❌ Failed to gather intelligence. Please try again.', 'error');
    } finally {
      setGatheringIntelligence(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-amber-100 text-amber-800';
      case 'PUBLISHED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredArticles = brief?.articles.filter(article => 
    searchQuery === '' || 
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.tldr.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.topics.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const newsletterArticles = brief?.articles.filter(article => article.inNewsletterQueue) || [];

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4"></div>
          </div>
          
          <nav className="flex-1 px-4 py-6">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </nav>
          
          <div className="p-4 border-t border-gray-200">
            <div className="h-16 bg-gray-100 rounded-lg animate-pulse mb-4"></div>
            <div className="h-12 bg-blue-100 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 p-8">
          <div className="space-y-6">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
                  <div className="h-6 bg-gray-200 rounded animate-pulse mb-3 w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-5/6"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md border border-red-100">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">{error}</p>
          <div className="space-y-3">
            <button 
              onClick={loadInitialData}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all duration-200 transform hover:scale-105"
            >
              🔄 Try Again
            </button>
            <p className="text-xs text-gray-500">
              If the problem persists, check your API keys and database connection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!brief || brief.status === "NO_BRIEFING") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-12 bg-white rounded-xl shadow-lg max-w-lg">
          <div className="text-6xl mb-6">🚀</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to ContentPilot</h2>
          <p className="text-gray-600 mb-8">Get started by gathering your first intelligence briefing</p>
          <button 
            onClick={handleGatherIntelligence}
            disabled={gatheringIntelligence}
            className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors shadow-lg"
          >
            {gatheringIntelligence ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Gathering Intelligence...
              </span>
            ) : (
              '🔍 Gather Intelligence'
            )}
          </button>
        </div>
      </div>
    );
  }

  const renderMainContent = () => {
    if (selectedArticle) {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="mb-8">
              <button 
                onClick={() => setSelectedArticle(null)}
                className="text-gray-500 hover:text-gray-700 mb-6 flex items-center font-medium"
              >
                ← Back to {activeView === 'overview' ? 'Overview' : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{selectedArticle.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6">
                <span className="font-medium">{selectedArticle.source.name}</span>
                <span>•</span>
                <span>{format(new Date(selectedArticle.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedArticle.status)}`}>
                  {selectedArticle.status}
                </span>
                {selectedArticle.inNewsletterQueue && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    📬 Newsletter
                  </span>
                )}
              </div>
            </div>

            {selectedArticle.tldr && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg mb-8">
                <h3 className="text-blue-900 font-semibold mb-2">💡 Key Takeaway</h3>
                <p className="text-blue-800 leading-relaxed">{selectedArticle.tldr}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-8">
              {selectedArticle.topics.map((topic) => (
                <span key={topic} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  #{topic}
                </span>
              ))}
            </div>

            <div className="prose max-w-none">
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg">
                {selectedArticle.content}
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-12 pt-8 border-t border-gray-200">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
                ✏️ Edit Article
              </button>
              <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors">
                {selectedArticle.inNewsletterQueue ? '📤 Remove from Newsletter' : '📬 Add to Newsletter'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Overview</h2>
              <p className="text-gray-600">Your content intelligence dashboard</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold text-blue-600">{brief.summary.totalArticles}</div>
                  <div className="text-blue-500 text-2xl">📄</div>
                </div>
                <div className="text-gray-600 font-medium">Total Articles</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold text-green-600">{brief.summary.articlesInQueue}</div>
                  <div className="text-green-500 text-2xl">📬</div>
                </div>
                <div className="text-gray-600 font-medium">Newsletter Queue</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold text-purple-600">{brief.summary.uniqueTopics}</div>
                  <div className="text-purple-500 text-2xl">🏷️</div>
                </div>
                <div className="text-gray-600 font-medium">Topics Covered</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold text-orange-600">{brief.summary.sourcesUsed}</div>
                  <div className="text-orange-500 text-2xl">🌐</div>
                </div>
                <div className="text-gray-600 font-medium">Sources Used</div>
              </div>
            </div>

            {brief.articles.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Articles</h3>
                <div className="space-y-4">
                  {brief.articles.slice(0, 5).map((article) => (
                    <div
                      key={article.id}
                      onClick={() => setSelectedArticle(article as FullArticle)}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{article.title}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{article.tldr}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{article.source.name}</span>
                            <span>•</span>
                            <span>{format(new Date(article.createdAt), "MMM d")}</span>
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col items-end space-y-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(article.status)}`}>
                            {article.status}
                          </span>
                          {article.inNewsletterQueue && (
                            <span className="text-green-600 text-sm">📬</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Articles Yet</h3>
                <p className="text-gray-600">Gather intelligence to see your first articles</p>
              </div>
            )}
          </div>
        );

      case 'articles':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">All Articles</h2>
                <p className="text-gray-600 mt-1">{filteredArticles.length} articles found</p>
              </div>
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {filteredArticles.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => setSelectedArticle(article as FullArticle)}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(article.status)}`}>
                        {article.status}
                      </span>
                      {article.inNewsletterQueue && (
                        <span className="text-green-600 text-lg">📬</span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2 leading-tight">{article.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{article.tldr}</p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.topics.slice(0, 2).map((topic) => (
                        <span key={topic} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          #{topic}
                        </span>
                      ))}
                      {article.topics.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          +{article.topics.length - 2}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="font-medium">{article.source.name}</span>
                      <span>{format(new Date(article.createdAt), "MMM d")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No articles found' : 'No articles yet'}
                </h3>
                <p className="text-gray-600">
                  {searchQuery ? 'Try adjusting your search terms' : 'Gather intelligence to see your first articles'}
                </p>
              </div>
            )}
          </div>
        );

      case 'newsletter':
        return (
          <div className="grid grid-cols-3 gap-8 items-start">
            {/* Newsletter Queue (Left/Center Column) */}
            <div className="col-span-2 space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Newsletter Queue</h2>
                <p className="text-gray-600 mt-1">{newsletterArticles.length} articles queued</p>
              </div>
              
              {newsletterArticles.length > 0 ? (
                <div className="space-y-4">
                  {newsletterArticles.map((article, index) => (
                    <div
                      key={article.id}
                      onClick={() => setSelectedArticle(article as FullArticle)}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">{article.title}</h3>
                          <p className="text-gray-600 text-sm mb-3">{article.tldr}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="font-medium">{article.source.name}</span>
                            <span>•</span>
                            <span>{format(new Date(article.createdAt), "MMM d, yyyy")}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(article.status)}`}>
                              {article.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="text-6xl mb-4">📬</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Newsletter Queue Empty</h3>
                  <p className="text-gray-600">Add articles to your newsletter queue to get started</p>
                </div>
              )}
            </div>

            {/* Mailing List (Right Column) */}
            <div className="col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mailing List ({subscribers.length})</h3>
                <div className="space-y-3">
                  {subscribers.map((subscriber) => (
                    <div key={subscriber.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-gray-800">{subscriber.name || 'Anonymous'}</p>
                        <p className="text-xs text-gray-500">{subscriber.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'topics':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Manage Topics</h2>
              <p className="text-gray-600 mt-1">Add or remove topics for content gathering</p>
            </div>

            <form onSubmit={handleCreateTopic} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-lg mb-4">Add New Topic</h3>
              <div className="flex space-x-4">
                <input
                  type="text"
                  placeholder="e.g., Artificial Intelligence"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSubmittingTopic || !newTopic.trim()}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {isSubmittingTopic ? 'Adding...' : 'Add Topic'}
                </button>
              </div>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-lg mb-4">Your Topics ({topics.length})</h3>
              {topics.length > 0 ? (
                <div className="space-y-3">
                  {topics.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <span className="font-medium text-gray-800">{topic.name}</span>
                      <button 
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">You haven&apos;t added any topics yet.</p>
              )}
            </div>
          </div>
        );

      case 'sources':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Manage Sources</h2>
              <p className="text-gray-600 mt-1">Add or remove content sources</p>
            </div>
  
            <form onSubmit={handleCreateSource} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-lg mb-4">Add New Source</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <input
                  type="text"
                  placeholder="Source Name (e.g., TechCrunch)"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="url"
                  placeholder="Source URL (e.g., https://techcrunch.com/feed)"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="font-medium">Type:</label>
                  {(['URL', 'RSS', 'API'] as const).map((type) => (
                    <label key={type} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sourceType"
                        value={type}
                        checked={newSource.type === type}
                        onChange={() => setNewSource({ ...newSource, type })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingSource}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {isSubmittingSource ? 'Adding...' : 'Add Source'}
                </button>
              </div>
            </form>
  
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-lg mb-4">Your Sources ({sources.length})</h3>
              {sources.length > 0 ? (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <span className="font-medium text-gray-800">{source.name}</span>
                        <p className="text-sm text-gray-500">{source.url}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-medium">{source.type}</span>
                        <button 
                          onClick={() => handleDeleteSource(source.id)}
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">You haven&apos;t added any sources yet.</p>
              )}
            </div>
          </div>
        );

      case 'settings':
        return <SettingsPage />;

      case 'automation':
        return <AutomationSettings />;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-0`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ContentPilot</h1>
              <p className="text-gray-500 text-sm mt-1">AI Intelligence System</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <div className="space-y-2">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'articles', label: 'Articles', icon: '📄' },
              { key: 'newsletter', label: 'Newsletters', icon: '📬' },
              { key: 'topics', label: 'Topics', icon: '🏷️' },
              { key: 'sources', label: 'Sources', icon: '🌐' },
              { key: 'settings', label: 'Settings', icon: '⚙️' },
              { key: 'automation', label: 'Automation', icon: '🤖' }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => { 
                  setActiveView(item.key as typeof activeView); 
                  setSelectedArticle(null); 
                  setSidebarOpen(false); // Close sidebar on mobile after selection
                }}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeView === item.key 
                    ? 'bg-blue-600 text-white shadow-sm transform scale-105' 
                    : 'text-gray-700 hover:bg-gray-100 hover:scale-102'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-800">Agent Status</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-800">UP</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleGatherIntelligence}
            disabled={gatheringIntelligence}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none"
          >
            {gatheringIntelligence ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Gathering...
              </span>
            ) : (
              '🔄 Gather Intelligence'
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              ☰
            </button>
            <h2 className="text-lg font-semibold text-gray-900 capitalize">{activeView}</h2>
            <div className="w-8"></div> {/* Spacer for centering */}
          </div>
        </div>

        <div className="p-4 lg:p-8">
          {renderMainContent()}
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border max-w-sm transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => setToast({ show: false, message: '', type: 'info' })}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}