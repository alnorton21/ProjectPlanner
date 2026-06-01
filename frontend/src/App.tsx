import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import GanttView from './pages/GanttView';
import TeamView from './pages/TeamView';
import Analytics from './pages/Analytics';
import AlertsPage from './pages/AlertsPage';
import ImportPage from './pages/ImportPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/ProjectPlanner">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="gantt" element={<GanttView />} />
            <Route path="team" element={<TeamView />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="import" element={<ImportPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
        }}
      />
    </QueryClientProvider>
  );
}
