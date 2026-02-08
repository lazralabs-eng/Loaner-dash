import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PendingRequests() {
  const [requests, setRequests] = useState([]);
  const [activeLoaners, setActiveLoaners] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [outgoingId, setOutgoingId] = useState('');
  const [pStockNumber, setPStockNumber] = useState('');
  const [completeLoading, setCompleteLoading] = useState(false);
  const [formData, setFormData] = useState({
    vin: '',
    year: '',
    make: '',
    model: '',
    color: '',
    license_plate: '',
    mileage_at_infleet: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('loaner_requests')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });
    setRequests(data || []);
  };

  const fetchActiveLoaners = async () => {
    const { data } = await supabase
      .from('loaner_requests')
      .select('id, vin, year, make, model')
      .eq('status', 'active')
      .order('infleet_approved_at', { ascending: false });
    setActiveLoaners(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('loaner_requests')
      .insert([{ ...formData, status: 'pending' }]);

    if (!error) {
      setShowForm(false);
      setFormData({ vin: '', year: '', make: '', model: '', color: '', license_plate: '', mileage_at_infleet: '' });
      fetchRequests();
    }
  };

  const openComplete = (reqId) => {
    setCompletingId(reqId);
    setOutgoingId('');
    setPStockNumber('');
    fetchActiveLoaners();
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!completingId) return;
    if (outgoingId && !pStockNumber.trim()) {
      alert('Enter P stock number for the vehicle coming out.');
      return;
    }
    setCompleteLoading(true);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const { error: errIn } = await supabase
      .from('loaner_requests')
      .update({
        status: 'active',
        infleet_approved_at: now,
        date_infleet: today,
        request_type: 'manual',
      })
      .eq('id', completingId);

    if (errIn) {
      alert('Error activating request: ' + errIn.message);
      setCompleteLoading(false);
      return;
    }

    if (outgoingId) {
      const { error: errOut } = await supabase
        .from('loaner_requests')
        .update({
          status: 'closed',
          defleet_confirmed_at: now,
          p_stock_number: pStockNumber.trim(),
        })
        .eq('id', outgoingId);

      if (errOut) {
        alert('Request is active but failed to close outgoing loaner: ' + errOut.message);
      }
    }

    setCompletingId(null);
    setOutgoingId('');
    setPStockNumber('');
    setCompleteLoading(false);
    fetchRequests();
    fetchActiveLoaners();
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 h-full overflow-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Pending Requests</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full sm:w-auto"
        >
          {showForm ? 'Cancel' : 'New Request'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded mb-6 max-w-2xl">
          <input
            type="text"
            placeholder="VIN"
            value={formData.vin}
            onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
            className="w-full bg-gray-700 text-white p-2 rounded mb-3"
            required
          />
          <input type="number" placeholder="Year" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} className="w-full bg-gray-700 text-white p-2 rounded mb-3" />
          <input type="text" placeholder="Make" value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} className="w-full bg-gray-700 text-white p-2 rounded mb-3" />
          <input type="text" placeholder="Model" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full bg-gray-700 text-white p-2 rounded mb-3" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Create Request
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 w-full">
        {requests.map((req) => (
          <div key={req.id} className="bg-gray-800 p-4 rounded text-white">
            <h3 className="font-bold">{req.customer_name || req.vin || 'Request'}</h3>
            <p className="text-gray-400 text-sm">VIN: {req.vin}</p>
            <p className="text-sm">{req.year} {req.make} {req.model}</p>
            <p className="text-sm mt-2">Status: <span className="text-yellow-400">{req.status}</span></p>
            <button
              type="button"
              onClick={() => openComplete(req.id)}
              className="mt-3 w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
            >
              Complete
            </button>
          </div>
        ))}
      </div>

      {completingId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleComplete} className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-white">
            <h3 className="text-lg font-bold mb-4">Complete request — assign to fleet</h3>
            <p className="text-gray-400 text-sm mb-4">Car going into service loaner will appear on Dashboard. Select the loaner coming out and assign P stock number.</p>
            <label className="block text-sm text-gray-400 mb-1">Loaner coming out (optional if adding first vehicle)</label>
            <select
              value={outgoingId}
              onChange={(e) => setOutgoingId(e.target.value)}
              className="w-full bg-gray-700 text-white p-2 rounded mb-4"
            >
              <option value="">None — new to fleet</option>
              {activeLoaners.map((l) => (
                <option key={l.id} value={l.id}>{l.year} {l.make} {l.model} — {l.vin}</option>
              ))}
            </select>
            {outgoingId && (
              <>
                <label className="block text-sm text-gray-400 mb-1">P stock number (for vehicle coming out)</label>
                <input
                  type="text"
                  placeholder="e.g. 12345"
                  value={pStockNumber}
                  onChange={(e) => setPStockNumber(e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 rounded mb-4"
                />
              </>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={completeLoading} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                {completeLoading ? 'Saving...' : 'Complete'}
              </button>
              <button type="button" onClick={() => setCompletingId(null)} className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-500">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
