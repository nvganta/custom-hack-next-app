import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  articleCounts: Record<string, number>;
}

export default function Calendar({ selectedDate, onDateSelect, articleCounts }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

  const days = [];
  const currentDate = new Date(startDate);

  // Generate 42 days (6 weeks) for the calendar grid
  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date: Date) => {
    return formatDateKey(date) === formatDateKey(today);
  };

  const isSelected = (date: Date) => {
    return formatDateKey(date) === selectedDate;
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const getArticleCount = (date: Date) => {
    return articleCounts[formatDateKey(date)] || 0;
  };

  const navigateToToday = () => {
    setCurrentMonth(new Date());
    onDateSelect(formatDateKey(today));
  };

  const clearFilter = () => {
    onDateSelect('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex space-x-1">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={navigateToToday}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
        >
          Today
        </button>
        {selectedDate && (
          <button
            onClick={clearFilter}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const articleCount = getArticleCount(date);
          const isCurrentMonthDate = isCurrentMonth(date);
          const isTodayDate = isToday(date);
          const isSelectedDate = isSelected(date);

          return (
            <button
              key={index}
              onClick={() => onDateSelect(formatDateKey(date))}
              className={`
                relative p-2 text-sm rounded-lg transition-all duration-200 hover:bg-gray-100
                ${!isCurrentMonthDate ? 'text-gray-400' : 'text-gray-900'}
                ${isTodayDate ? 'bg-blue-100 text-blue-900 ring-2 ring-blue-500' : ''}
                ${isSelectedDate ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                ${articleCount > 0 && !isSelectedDate ? 'font-semibold' : ''}
              `}
            >
              <span className="block">{date.getDate()}</span>
              {articleCount > 0 && (
                <span className={`
                  absolute top-1 right-1 text-xs rounded-full w-4 h-4 flex items-center justify-center
                  ${isSelectedDate ? 'bg-blue-300 text-blue-900' : 'bg-red-500 text-white'}
                `}>
                  {articleCount > 9 ? '9+' : articleCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-100 border-2 border-blue-500 rounded"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Has Articles</span>
            </div>
          </div>
          <span>{days.filter(date => isCurrentMonth(date) && getArticleCount(date) > 0).length} days with content</span>
        </div>
      </div>
    </div>
  );
} 