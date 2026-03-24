import React from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Clock, DollarSign, MapPin, Star } from 'lucide-react';

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

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      disputed: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getEscrowStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      INIT: 'bg-gray-100 text-gray-600',
      FUNDED: 'bg-green-100 text-green-600',
      IN_PROGRESS: 'bg-blue-100 text-blue-600',
      PENDING_RELEASE: 'bg-yellow-100 text-yellow-600',
      RELEASED: 'bg-green-100 text-green-600',
      REFUNDED: 'bg-red-100 text-red-600',
      DISPUTE: 'bg-orange-100 text-orange-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-100"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">{task.title}</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
          {task.status === 'open' ? 'Открыто' : 
           task.status === 'in_progress' ? 'В работе' :
           task.status === 'completed' ? 'Завершено' :
           task.status === 'cancelled' ? 'Отменено' : 'Спор'}
        </span>
      </div>

      <p className="text-gray-600 mb-4 line-clamp-3">{task.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
          {task.category}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm ${getEscrowStatusColor(task.escrow_status)}`}>
          Escrow: {task.escrow_status}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-700">
          <DollarSign className="w-5 h-5" />
          <span className="font-medium">
            {task.budget_min.toLocaleString('ru-RU')} - {task.budget_max.toLocaleString('ru-RU')} {task.currency}
          </span>
        </div>
        
        {task.deadline && (
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              {format(new Date(task.deadline), 'dd MMM yyyy', { locale: ru })}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {task.customer_avatar ? (
            <img 
              src={task.customer_avatar} 
              alt={task.customer_name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-600 font-medium">
                {task.customer_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{task.customer_name}</p>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-gray-500">{task.customer_rating}</span>
            </div>
          </div>
        </div>
        
        <span className="text-xs text-gray-400">
          {format(new Date(task.created_at), 'dd MMM', { locale: ru })}
        </span>
      </div>
    </div>
  );
};