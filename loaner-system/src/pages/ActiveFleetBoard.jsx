import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import VehicleDetail from '../components/VehicleDetail';

const initialAddForm = {
  vin: '',
  year: '',
  make: '',
  model: '',
  color: '',
  license_plate: '',
  mileage_at_infleet: '',
  vehicle_cost: '',
  rdr_date: '', // service loaner in-service date (timer for velocity)
};

const DAYS_6_MONTHS = 180;
const DAYS_10_BEFORE_7_MONTHS = 7 * 30 - 10; // 200
const MILEAGE_10K = 10000;

export default function ActiveFleetBoard() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(initialAddForm);
  const [addLoading, setAddLoading] = useState(false);
  const [contractFilter, setContractFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('all');
  const [mileageFilter, setMileageFilter] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchVehicles();
    const pollInterval = setInterval(fetchVehicles, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('loaner_requests')
      .select('*')
      .eq('status', 'active')
      .order('date_infleet', { ascending: false });
    setVehicles(data || []);
  };

  const calculateDaysInLoanerFleet = (vehicle) => {
    const start = vehicle?.rdr_date || vehicle?.date_infleet || vehicle?.infleet_approved_at;
    if (!start) return 0;
    const now = new Date();
    const startDate = new Date(start);
    const days = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const uniqueMakes = [...new Set(vehicles.map(v => v.make).filter(Boolean))].sort();
  const uniqueModels = [...new Set(vehicles.map(v => v.model).filter(Boolean))].sort();
  const uniqueYears = [...new Set(vehicles.map(v => v.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a));

  const filtered = vehicles.filter((v) => {
    const matchesSearch = !searchTerm || v.vin?.includes(searchTerm) ||
      v.license_plate?.includes(searchTerm) ||
      `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (contractFilter !== 'all') {
      const onContract = v.contract_status === 'on_contract';
      if (contractFilter === 'on_contract' && !onContract) return false;
      if (contractFilter === 'off_contract' && onContract) return false;
    }

    const days = calculateDaysInLoanerFleet(v);
    if (daysFilter !== 'all') {
      if (daysFilter === 'under_6mo' && days >= DAYS_6_MONTHS) return false;
      if (daysFilter === '6mo_plus' && days < DAYS_6_MONTHS) return false;
      if (daysFilter === '10d_from_7mo' && days < DAYS_10_BEFORE_7_MONTHS) return false;
    }

    const mileage = v.mileage_at_infleet != null ? Number(v.mileage_at_infleet) : null;
    if (mileageFilter !== 'all' && mileage != null) {
      if (mileageFilter === 'under_10k' && mileage >= MILEAGE_10K) return false;
      if (mileageFilter === '10k_plus' && mileage < MILEAGE_10K) return false;
    }
    if (mileageFilter !== 'all' && mileage == null) return false; // no mileage data

    if (makeFilter !== 'all' && v.make !== makeFilter) return false;
    if (modelFilter !== 'all' && v.model !== modelFilter) return false;
    if (yearFilter !== 'all' && String(v.year) !== yearFilter) return false;

    return true;
  });

  const clearFilters = () => {
    setContractFilter('all');
    setDaysFilter('all');
    setMileageFilter('all');
    setMakeFilter('all');
    setModelFilter('all');
    setYearFilter('all');
  };
  const hasActiveFilters = contractFilter !== 'all' || daysFilter !== 'all' || mileageFilter !== 'all' || makeFilter !== 'all' || modelFilter !== 'all' || yearFilter !== 'all';

  const handleAddLoaner = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const row = {
      vin: addForm.vin,
      year: addForm.year === '' ? null : Number(addForm.year) || null,
      make: addForm.make || null,
      model: addForm.model || null,
      color: addForm.color || null,
      license_plate: addForm.license_plate || null,
      mileage_at_infleet: addForm.mileage_at_infleet === '' ? null : Number(addForm.mileage_at_infleet) || null,
      vehicle_cost: addForm.vehicle_cost === '' ? null : Number(addForm.vehicle_cost) || null,
      rdr_date: addForm.rdr_date || today,
      status: 'active',
      request_type: 'manual',
      infleet_approved_at: now,
      date_infleet: today,
    };
    const { error } = await supabase.from('loaner_requests').insert([row]);
    setAddLoading(false);
    if (!error) {
      setShowAddForm(false);
      setAddForm(initialAddForm);
      fetchVehicles();
    } else {
      alert('Error adding loaner: ' + error.message);
    }
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 h-full overflow-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white shrink-0">Active Loaners</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search VIN, plate, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-xs bg-gray-700 text-white px-4 py-2 rounded flex-1 min-w-0"
          />
          <button
          type="button"
          onClick={() => {
            setAddForm({ ...initialAddForm, rdr_date: new Date().toISOString().slice(0, 10) });
            setShowAddForm(true);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add loaner
          </button>
        </div>
        <p className="text-gray-400 text-sm">{filtered.length} active loaner{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-2"
        >
          {showFilters ? 'Hide filters' : 'Show filters'}
          {hasActiveFilters && <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">on</span>}
        </button>
        {showFilters && (
          <div className="mt-2 p-4 bg-gray-800 rounded-lg flex flex-wrap items-center gap-3">
            <select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="all">Contract: All</option>
              <option value="on_contract">On contract</option>
              <option value="off_contract">Off contract</option>
            </select>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="all">Days in fleet: All</option>
              <option value="under_6mo">Under 6 months</option>
              <option value="6mo_plus">6+ months (candidate)</option>
              <option value="10d_from_7mo">10 days from 7 months (urgent)</option>
            </select>
            <select
              value={mileageFilter}
              onChange={(e) => setMileageFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="all">Mileage: All</option>
              <option value="under_10k">Under 10k mi</option>
              <option value="10k_plus">10k+ mi (out before 10k)</option>
            </select>
            <select
              value={makeFilter}
              onChange={(e) => setMakeFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="all">Make: All</option>
              {uniqueMakes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="all">Model: All</option>
              {uniqueModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="all">Year: All</option>
              {uniqueYears.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-gray-400 hover:text-white text-sm underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddLoaner} className="bg-gray-800 p-6 rounded mb-6 max-w-2xl">
          <h2 className="text-xl font-bold text-white mb-4">Manually add loaner</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              placeholder="VIN *"
              value={addForm.vin}
              onChange={(e) => setAddForm({ ...addForm, vin: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
              required
            />
            <input
              type="text"
              placeholder="License plate"
              value={addForm.license_plate}
              onChange={(e) => setAddForm({ ...addForm, license_plate: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
            />
            <input
              type="number"
              placeholder="Year"
              value={addForm.year}
              onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
            />
            <input
              type="text"
              placeholder="Make"
              value={addForm.make}
              onChange={(e) => setAddForm({ ...addForm, make: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
            />
            <input
              type="text"
              placeholder="Model"
              value={addForm.model}
              onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
            />
            <input
              type="text"
              placeholder="Color"
              value={addForm.color}
              onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
            />
            <input
              type="number"
              placeholder="Mileage"
              value={addForm.mileage_at_infleet}
              onChange={(e) => setAddForm({ ...addForm, mileage_at_infleet: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
              min="0"
            />
            <input
              type="number"
              placeholder="Vehicle cost ($)"
              value={addForm.vehicle_cost}
              onChange={(e) => setAddForm({ ...addForm, vehicle_cost: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
              min="0"
              step="0.01"
            />
            <input
              type="date"
              value={addForm.rdr_date}
              onChange={(e) => setAddForm({ ...addForm, rdr_date: e.target.value })}
              className="bg-gray-700 text-white p-2 rounded"
              title="RDR Date - service loaner in-service date (timer for velocity)"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {addLoading ? 'Adding...' : 'Add to fleet'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddForm(initialAddForm); }}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 w-full">
        {filtered.map((vehicle) => {
          const daysIn = calculateDaysInLoanerFleet(vehicle);
          const isOnContract = vehicle.contract_status === 'on_contract';
          const mileage = vehicle.mileage_at_infleet != null ? Number(vehicle.mileage_at_infleet).toLocaleString() : null;

          return (
            <div
              key={vehicle.id}
              onClick={() => setSelectedVehicle(vehicle)}
              className="bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-700 transition border-l-4 border-blue-500"
            >
              <h3 className="font-bold text-white text-lg">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              <p className="text-gray-400 text-sm">VIN: {vehicle.vin}</p>
              <p className="text-gray-400 text-sm">Plate: <span className="text-yellow-400 font-mono">{vehicle.license_plate || '—'}</span></p>
              <p className="text-gray-400 text-sm">Days in fleet: {daysIn}</p>
              {mileage != null && <p className="text-gray-400 text-sm">Mileage: {mileage} mi</p>}
              <div className="mt-3 flex gap-2">
                <span className={`px-2 py-1 rounded text-xs ${isOnContract ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                  {isOnContract ? 'ON CONTRACT' : 'OFF CONTRACT'}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-blue-900 text-blue-200">
                  {vehicle.lot_status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedVehicle && (
        <VehicleDetail 
          vehicle={selectedVehicle} 
          onClose={() => setSelectedVehicle(null)}
          daysInLoanerFleet={calculateDaysInLoanerFleet(selectedVehicle)}
        />
      )}
    </div>
  );
}
