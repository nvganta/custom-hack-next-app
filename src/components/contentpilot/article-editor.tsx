"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

interface Article {
  id: string;
  title: string;
  content: string;
  tldr: string;
  topics: string[];
  source: {
    name: string;
    url: string;
  };
  status: string;
  inNewsletterQueue: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ArticleEditorProps {
  article: Article | null;
  onSave: (articleId: string, updates: Partial<Article>) => Promise<void>;
  onDelete: (articleId: string) => Promise<void>;
  onToggleNewsletter: (articleId: string, action: 'ADD' | 'REMOVE') => Promise<void>;
  loading?: boolean;
}

export default function ArticleEditor({
  article,
  onSave,
  onDelete,
  onToggleNewsletter,
  loading = false
}: ArticleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedTldr, setEditedTldr] = useState('');
  const [editedTopics, setEditedTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (article) {
      setEditedTitle(article.title);
      setEditedContent(article.content);
      setEditedTldr(article.tldr || '');
      setEditedTopics(article.topics || []);
      setIsEditing(false);
      setPreviewMode(false);
      setShowDeleteConfirm(false);
    }
  }, [article?.id]);

  if (!article) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Article</h3>
          <p className="text-gray-600">Choose an article from the list to view or edit it</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!article) return;
    
    setSaving(true);
    try {
      await onSave(article.id, {
        title: editedTitle,
        content: editedContent,
        tldr: editedTldr,
        topics: editedTopics,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save article:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!article) return;
    
    try {
      await onDelete(article.id);
    } catch (error) {
      console.error('Failed to delete article:', error);
    }
  };

  const handleToggleNewsletter = async () => {
    if (!article) return;
    
    try {
      await onToggleNewsletter(
        article.id,
        article.inNewsletterQueue ? 'REMOVE' : 'ADD'
      );
    } catch (error) {
      console.error('Failed to toggle newsletter status:', error);
    }
  };

  const addTopic = () => {
    if (newTopic.trim() && !editedTopics.includes(newTopic.trim())) {
      setEditedTopics([...editedTopics, newTopic.trim()]);
      setNewTopic('');
    }
  };

  const removeTopic = (topicToRemove: string) => {
    setEditedTopics(editedTopics.filter(topic => topic !== topicToRemove));
  };

  const hasChanges = 
    editedTitle !== article.title ||
    editedContent !== article.content ||
    editedTldr !== (article.tldr || '') ||
    JSON.stringify(editedTopics) !== JSON.stringify(article.topics || []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Article' : 'Article'}
              </h1>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  article.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                  article.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {article.status}
                </span>
                {article.inNewsletterQueue && (
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
                    onClick={() => {
                      setIsEditing(false);
                      setEditedTitle(article.title);
                      setEditedContent(article.content);
                      setEditedTldr(article.tldr || '');
                      setEditedTopics(article.topics || []);
                    }}
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

          {/* Metadata */}
          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
            <span>Source: {article.source.name}</span>
            <span>•</span>
            <span>Created: {format(new Date(article.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
            {article.author && (
              <>
                <span>•</span>
                <span>Author: {article.author.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  hasChanges && !saving
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : 'SAVE'}
              </button>

              <button
                onClick={handleToggleNewsletter}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  article.inNewsletterQueue
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                {article.inNewsletterQueue ? 'REMOVE FROM NEWSLETTER' : 'ADD TO NEWSLETTER'}
              </button>
            </div>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
            >
              DELETE
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isEditing ? (
          <div className="h-full flex">
            {/* Edit Mode */}
            {!previewMode ? (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* TL;DR */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      TL;DR Summary
                    </label>
                    <textarea
                      value={editedTldr}
                      onChange={(e) => setEditedTldr(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief summary of the article..."
                    />
                  </div>

                  {/* Topics */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topics
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {editedTopics.map((topic) => (
                        <span
                          key={topic}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {topic}
                          <button
                            onClick={() => removeTopic(topic)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                        placeholder="Add a topic..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={addTopic}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content (Markdown supported)
                    </label>
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="Article content in Markdown format..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Preview Mode */
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-none">
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">{editedTitle}</h1>
                  
                  {editedTldr && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                      <p className="font-medium text-blue-900">TL;DR</p>
                      <p className="text-blue-800">{editedTldr}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-6">
                    {editedTopics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>

                  <div className="prose max-w-none">
                    <ReactMarkdown>{editedContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* View Mode */
          <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-none">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
              
              {article.tldr && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                  <p className="font-medium text-blue-900">TL;DR</p>
                  <p className="text-blue-800">{article.tldr}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-6">
                {article.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              <div className="prose max-w-none">
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Article</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &quot;{article.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 