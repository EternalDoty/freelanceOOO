import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { Login } from './pages/Login';
import { TasksFeed } from './pages/TasksFeed';
import { useAuthStore } from './store/authStore';
import { authApi } from './services/api';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isBlocked } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Аккаунт заблокирован</h2>
          <p className="text-gray-600 mb-6">
            Ваш аккаунт был заблокирован. Вы можете подать апелляцию в службе поддержки.
          </p>
          <button
            onClick={() => window.location.href = '/support'}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Подать апелляцию
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AuthCallbackPage: React.FC = () => {
  const { login, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const callbackToken = urlParams.get('token');
    const isBlocked = urlParams.get('blocked') === 'true';

    if (!callbackToken) {
      navigate('/login');
      return;
    }

    const decodedToken = decodeURIComponent(callbackToken);

    login(
      decodedToken,
      {
        id: '',
        username: '',
        email: '',
        role: 'freelancer',
        rating: '0',
        total_tasks: 0,
        completed_tasks: 0,
      },
      isBlocked
    );

    authApi.verify(decodedToken)
      .then(response => {
        updateUser(response.data.user);
        navigate('/');
      })
      .catch(() => {
        logout();
        navigate('/login');
      });
  }, [login, logout, updateUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow">
        <p>Обрабатываем авторизацию...</p>
      </div>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { login, logout, token } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const verifyToken = async () => {
      if (token && location.pathname !== '/auth/callback') {
        try {
          const response = await authApi.verify(token);
          login(token, response.data.user);
        } catch (error) {
          logout();
        }
      }
    };

    verifyToken();
  }, [login, logout, token, location.pathname]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TasksFeed />
            </ProtectedRoute>
          }
        />
        <Route path="/tasks" element={
          <ProtectedRoute>
            <TasksFeed />
          </ProtectedRoute>
        } />
        <Route path="/tasks/:id" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">Task Detail Page</div>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">Profile Page</div>
          </ProtectedRoute>
        } />
        <Route path="/support" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">Support Page</div>
          </ProtectedRoute>
        } />
        <Route path="/appeals" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">Appeals Page</div>
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
