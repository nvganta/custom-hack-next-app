"use client";

import { useState } from "react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";

interface Article {
  id: string;
  title: string;
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
}

interface ArticleListProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
  onToggleNewsletter: (articleId: string, action: 'ADD' | 'REMOVE') => void;
  selectedArticleId?: string;
  loading?: boolean;
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

  // Sort groups by date (newest first)
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

export default function ArticleList({ 
  articles, 
  onSelectArticle, 
  onToggleNewsletter,
  selectedArticleId,
  loading = false
}: ArticleListProps) {
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'queued'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Show loading skeleton
  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b bg-white">
          <div className="h-6 bg-gray-200 rounded animate-pulse mb-4 w-1/3"></div>
          <div className="h-10 bg-gray-100 rounded animate-pulse mb-4"></div>
          <div className="flex space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-gray-100 rounded-full animate-pulse w-16"></div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="h-5 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2 w-full"></div>
                <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3"></div>
                <div className="flex space-x-2 mt-3">
                  <div className="h-6 bg-gray-100 rounded-full animate-pulse w-16"></div>
                  <div className="h-6 bg-gray-100 rounded-full animate-pulse w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter articles
  const filteredArticles = articles.filter(article => {
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
  });

  const groupedArticles = groupArticlesByDate(filteredArticles);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800';
      case 'PUBLISHED': return 'bg-green-100 text-green-800';
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
          <div className="text-sm text-gray-500">
            {filteredArticles.length} of {articles.length} articles
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search articles, topics, or sources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              🔍
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'draft', label: 'Drafts' },
            { key: 'published', label: 'Published' },
            { key: 'queued', label: 'Queued' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as 'all' | 'draft' | 'published' | 'queued')}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
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
            {searchTerm && (
              <p className="text-sm mt-1">Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          groupedArticles.map(({ dateKey, date, articles: groupArticles }) => (
            <div key={dateKey} className="border-b border-gray-100 last:border-b-0">
              {/* Date Header */}
              <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">
                  {formatDateGroup(date)}
                </h3>
                <p className="text-xs text-gray-500">
                  {groupArticles.length} article{groupArticles.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Articles */}
              <div className="divide-y divide-gray-100">
                {groupArticles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => onSelectArticle(article)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedArticleId === article.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                          {article.title}
                        </h4>
                        
                        {article.tldr && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                            {article.tldr}
                          </p>
                        )}

                        <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                          <span>{article.source.name}</span>
                          <span>•</span>
                          <span>{format(new Date(article.createdAt), "h:mm a")}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(article.status)}`}>
                            {article.status}
                          </span>
                          
                          {article.inNewsletterQueue && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Queued
                            </span>
                          )}

                          {article.topics.slice(0, 2).map((topic) => (
                            <span
                              key={topic}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                            >
                              {topic}
                            </span>
                          ))}
                          
                          {article.topics.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{article.topics.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onToggleNewsletter(
                              article.id,
                              article.inNewsletterQueue ? 'REMOVE' : 'ADD'
                            );
                          }}
                          className={`p-1 rounded hover:bg-gray-200 ${
                            article.inNewsletterQueue 
                              ? 'text-purple-600' 
                              : 'text-gray-400'
                          }`}
                          title={article.inNewsletterQueue ? 'Remove from newsletter' : 'Add to newsletter'}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                        </button>
                        
                        <div className="w-2 h-2 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 