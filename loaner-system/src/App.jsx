import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import ActiveFleetBoard from './pages/ActiveFleetBoard';
import PendingRequests from './pages/PendingRequests';
import LoanerHistory from './pages/LoanerHistory';
import Navigation from './components/Navigation';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <LoginPage />;

  return (
    <div className="flex w-full min-h-screen bg-gray-900">
      <Navigation user={user} setUser={setUser} setCurrentPage={setCurrentPage} />
      <main className="flex-1 min-w-0 w-full overflow-auto p-4 sm:p-6 lg:p-8">
        {currentPage === 'dashboard' && <ActiveFleetBoard />}
        {currentPage === 'requests' && <PendingRequests />}
        {currentPage === 'history' && <LoanerHistory />}
      </main>
    </div>
  );
}
