import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function VehicleDetail({ vehicle, onClose, daysInLoanerFleet }) {
  const [showSwapForm, setShowSwapForm] = useState(false);
  const [replacementVin, setReplacementVin] = useState('');
  const [replacementYear, setReplacementYear] = useState('');
  const [replacementMake, setReplacementMake] = useState('');
  const [replacementModel, setReplacementModel] = useState('');
  const [replacementColor, setReplacementColor] = useState('');
  const [replacementTrim, setReplacementTrim] = useState('');
  const [replacementMiles, setReplacementMiles] = useState('');
  const [loading, setLoading] = useState(false);

  const resetReplacementForm = () => {
    setReplacementVin('');
    setReplacementYear('');
    setReplacementMake('');
    setReplacementModel('');
    setReplacementColor('');
    setReplacementTrim('');
    setReplacementMiles('');
  };

  const handleSubmitSwap = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const makeModel = [replacementYear, replacementMake, replacementModel].filter(Boolean).join(' ');
    const payload = {
      loaner_id: vehicle.id,
      replacement_vin: replacementVin,
      replacement_make_model: makeModel || undefined,
      status: 'pending',
      requested_by: user.id,
    };
    if (replacementColor) payload.replacement_color = replacementColor;
    if (replacementTrim) payload.replacement_trim = replacementTrim;
    if (replacementMiles !== '') payload.replacement_miles = replacementMiles === '' ? null : Number(replacementMiles);

    const { error } = await supabase.from('loaner_swap_requests').insert([payload]);

    if (!error) {
      setShowSwapForm(false);
      resetReplacementForm();
      alert('Swap request submitted');
      onClose();
    } else {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const contractDays = vehicle.contract_date 
    ? Math.floor((new Date() - new Date(vehicle.contract_date)) / (1000 * 60 * 60 * 24))
    : null;

  const DAYS_6_MONTHS = 180;
  const DAYS_10_BEFORE_7_MONTHS = 7 * 30 - 10; // 200 days
  const isCostVelocityCandidate = daysInLoanerFleet >= DAYS_6_MONTHS;
  const isUrgentCostVelocity = daysInLoanerFleet >= DAYS_10_BEFORE_7_MONTHS;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg max-w-2xl w-full max-h-screen overflow-auto text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <p className="text-gray-400">VIN: {vehicle.vin}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">License Plate</p>
            <p className="text-xl font-mono font-bold text-yellow-400">{vehicle.license_plate || '—'}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">RDR Date (in-service)</p>
            <p className="text-xl font-bold text-white">
              {vehicle.rdr_date ? new Date(vehicle.rdr_date).toLocaleDateString() : '—'}
            </p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Days in loaner fleet</p>
            <p className="text-xl font-bold text-blue-400">{daysInLoanerFleet} days</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Mileage</p>
            <p className="text-xl font-bold text-white">
              {vehicle.mileage_at_infleet != null ? `${Number(vehicle.mileage_at_infleet).toLocaleString()} mi` : '—'}
            </p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Status</p>
            <p className="text-xl font-bold">{vehicle.lot_status || vehicle.status || '—'}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Color</p>
            <p className="text-xl font-bold">{vehicle.color || '—'}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Trim</p>
            <p className="text-xl font-bold">{vehicle.trim || '—'}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Vehicle cost</p>
            <p className="text-xl font-bold text-white">
              {vehicle.vehicle_cost != null && vehicle.vehicle_cost !== ''
                ? `$${Number(vehicle.vehicle_cost).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : '—'}
            </p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-400 text-sm">Contract Status</p>
            <p className={`text-xl font-bold ${vehicle.contract_status === 'on_contract' ? 'text-red-400' : 'text-green-400'}`}>
              {vehicle.contract_status === 'on_contract' ? `ON CONTRACT (${contractDays} days)` : 'OFF CONTRACT'}
            </p>
          </div>
        </div>

        {isCostVelocityCandidate && (
          <div
            className={`p-4 rounded-lg mb-6 border ${
              isUrgentCostVelocity
                ? 'bg-red-100 border-red-400 text-red-900'
                : 'bg-green-100 border-green-400 text-green-900'
            }`}
          >
            <p className="font-bold">Vehicle cost velocity candidate</p>
            <p className="text-sm mt-1">
              {isUrgentCostVelocity
                ? `In fleet ${daysInLoanerFleet} days — 10 days from 7 months. Consider replacement soon.`
                : `In fleet ${daysInLoanerFleet} days (6+ months). Candidate for CPO or replacement.`}
            </p>
          </div>
        )}

        {!showSwapForm ? (
          <button
            onClick={() => setShowSwapForm(true)}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 w-full"
          >
            Request Swap
          </button>
        ) : (
          <div className="bg-gray-700 p-6 rounded">
            <h3 className="font-bold mb-4 text-lg">New Car Replacement</h3>
            <input
              type="text"
              placeholder="Replacement Vehicle VIN"
              value={replacementVin}
              onChange={(e) => setReplacementVin(e.target.value)}
              className="w-full bg-gray-600 text-white p-2 rounded mb-3"
              required
            />
            <div className="grid grid-cols-3 gap-2 mb-3">
              <input
                type="text"
                placeholder="Year"
                value={replacementYear}
                onChange={(e) => setReplacementYear(e.target.value)}
                className="w-full bg-gray-600 text-white p-2 rounded"
              />
              <input
                type="text"
                placeholder="Make"
                value={replacementMake}
                onChange={(e) => setReplacementMake(e.target.value)}
                className="w-full bg-gray-600 text-white p-2 rounded"
              />
              <input
                type="text"
                placeholder="Model"
                value={replacementModel}
                onChange={(e) => setReplacementModel(e.target.value)}
                className="w-full bg-gray-600 text-white p-2 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                type="text"
                placeholder="Color"
                value={replacementColor}
                onChange={(e) => setReplacementColor(e.target.value)}
                className="w-full bg-gray-600 text-white p-2 rounded"
              />
              <input
                type="text"
                placeholder="Trim"
                value={replacementTrim}
                onChange={(e) => setReplacementTrim(e.target.value)}
                className="w-full bg-gray-600 text-white p-2 rounded"
              />
            </div>
            <input
              type="number"
              placeholder="Miles"
              value={replacementMiles}
              onChange={(e) => setReplacementMiles(e.target.value)}
              className="w-full bg-gray-600 text-white p-2 rounded mb-4"
              min="0"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitSwap}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                onClick={() => setShowSwapForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
