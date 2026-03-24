import React from 'react';
import { useLocation } from 'react-router-dom';
import { Github } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const Login: React.FC = () => {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const error = urlParams.get('error');
  const details = urlParams.get('details');

  const handleGitHubLogin = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Freelance Platform
          </h1>
          <p className="text-gray-600">
            Безопасная платформа для фрилансеров и заказчиков
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Github className="w-5 h-5" />
            Войти через GitHub
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 text-sm text-red-700 bg-red-100 rounded">
            <p>Ошибка авторизации: {error.replace('_', ' ')}</p>
            {details && <p>Подробности: {decodeURIComponent(details)}</p>}
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <p className="text-sm text-gray-600">
                Безопасные сделки через Escrow систему
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <p className="text-sm text-gray-600">
                Динамическая комиссия от 0.5% до 1%
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <p className="text-sm text-gray-600">
                AI-поддержка и система апелляций
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};