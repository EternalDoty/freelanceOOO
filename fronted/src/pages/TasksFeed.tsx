import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Filter, Search, Plus } from 'lucide-react';
import { TaskCard } from '../components/TaskCard';
import { tasksApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  budget_min: number;
  budget_max: number;
  currency: string;
  status: string;
  escrow_status: string;
  deadline: string;
  created_at: string;
  customer_name: string;
  customer_avatar?: string;
  customer_rating: string;
}

export const TasksFeed: React.FC = () => {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    min_budget: '',
    max_budget: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading, error, refetch } = useQuery(
    ['tasks', filters],
    () => tasksApi.getAll(filters),
    {
      select: (response) => response.data.tasks,
    }
  );

  const filteredTasks = data?.filter((task: Task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    toast.error('Ошибка загрузки задач');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Лента задач</h1>
            {user?.role === 'customer' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Создать задачу
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Поиск задач..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Все статусы</option>
              <option value="open">Открытые</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Завершенные</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Все категории</option>
              <option value="development">Разработка</option>
              <option value="design">Дизайн</option>
              <option value="marketing">Маркетинг</option>
              <option value="writing">Тексты</option>
            </select>

            <button
              onClick={() => setFilters({ status: '', category: '', min_budget: '', max_budget: '' })}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Сбросить
            </button>
          </div>
        </div>

        {/* Tasks Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredTasks?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Задачи не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks?.map((task: Task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => {/* Navigate to task detail */}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};