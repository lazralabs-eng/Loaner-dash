import { supabase } from '../lib/supabase';

export default function Navigation({ user, setUser, setCurrentPage }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <nav className="bg-gray-800 w-52 sm:w-64 shrink-0 p-4 text-white">
      <h2 className="text-xl font-bold mb-6">Loaner Dash</h2>
      <div className="space-y-4">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className="block w-full text-left hover:text-blue-400 bg-gray-700 p-2 rounded"
        >
          Dashboard
        </button>
        <button
          onClick={() => setCurrentPage('requests')}
          className="block w-full text-left hover:text-blue-400 bg-gray-700 p-2 rounded"
        >
          Requests
        </button>
        <button
          onClick={() => setCurrentPage('history')}
          className="block w-full text-left hover:text-blue-400 bg-gray-700 p-2 rounded"
        >
          History
        </button>
      </div>
      <div className="mt-8 pt-8 border-t border-gray-600">
        <p className="text-sm text-gray-400">{user?.email}</p>
        <button onClick={handleLogout} className="text-red-400 hover:text-red-300 mt-4">
          Logout
        </button>
      </div>
    </nav>
  );
}
