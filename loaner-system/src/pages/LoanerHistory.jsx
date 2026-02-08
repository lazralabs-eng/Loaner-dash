import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function LoanerHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    const pollInterval = setInterval(fetchHistory, 60000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('loaner_requests')
      .select('*')
      .in('status', ['closed', 'confirmed', 'return_requested'])
      .order('defleet_confirmed_at', { ascending: false })
      .order('infleet_approved_at', { ascending: false });
    setRecords(data || []);
    setLoading(false);
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
  const daysInFleet = (infleet, defleet) => {
    const start = infleet ? new Date(infleet) : null;
    const end = defleet ? new Date(defleet) : new Date();
    if (!start) return 0;
    return Math.floor((end - start) / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="p-4 sm:p-6 lg:p-8 text-white">Loading history...</div>;

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 h-full overflow-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Loaner History</h1>
      <p className="text-gray-400 mb-6">
        Pulled for CPO and entered into loaner from new. Closed and returned loaners.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 w-full">
        {records.map((r) => (
          <div
            key={r.id}
            className="bg-gray-800 p-4 rounded text-white"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="font-bold">{r.year} {r.make} {r.model}</p>
              {r.p_stock_number && (
                <span className="text-yellow-400 font-mono text-sm">P{r.p_stock_number}</span>
              )}
            </div>
            <p className="text-gray-400 text-sm">VIN: {r.vin}</p>
            <p className="text-sm mt-2">
              {r.mileage_at_infleet != null && <span>In: {Number(r.mileage_at_infleet).toLocaleString()} mi</span>}
              {r.mileage_at_defleet != null && <span className="ml-2">Out: {Number(r.mileage_at_defleet).toLocaleString()} mi</span>}
              {r.mileage_at_infleet == null && r.mileage_at_defleet == null && '—'}
            </p>
            <p className="text-sm text-gray-400 mt-1">{daysInFleet(r.infleet_approved_at || r.date_infleet, r.defleet_confirmed_at || r.defleet_dealer_timestamp)} days in fleet</p>
            <p className="text-xs text-gray-500 mt-2">
              Out: {formatDate(r.infleet_approved_at || r.date_infleet)} · Back: {formatDate(r.defleet_confirmed_at || r.defleet_dealer_timestamp)}
            </p>
          </div>
        ))}
      </div>

      {records.length === 0 && (
        <p className="text-gray-400">No history yet. Closed or returned loaners will appear here.</p>
      )}
    </div>
  );
}
