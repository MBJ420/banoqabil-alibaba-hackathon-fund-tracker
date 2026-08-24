import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import NewsPage from './pages/News';
import AINewsPage from './pages/AINews';
import PortfolioSuggestions from './pages/PortfolioSuggestions';
import InflationSimulator from './pages/InflationSimulator';
import TaxOptimizer from './pages/TaxOptimizer';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/Toast';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route path="news" element={<ErrorBoundary name="Market News"><NewsPage /></ErrorBoundary>} />
            <Route path="ai-news" element={<ErrorBoundary name="AI Analysis"><AINewsPage /></ErrorBoundary>} />
            <Route path="suggestions" element={<ErrorBoundary name="Portfolio Suggestions"><PortfolioSuggestions /></ErrorBoundary>} />
            <Route path="simulator" element={<ErrorBoundary name="Inflation Simulator"><InflationSimulator /></ErrorBoundary>} />
            <Route path="tax" element={<ErrorBoundary name="Tax Optimizer"><TaxOptimizer /></ErrorBoundary>} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default App;
