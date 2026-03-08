import React, { useState } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { FuelStation } from '../types';
import { api } from '../App';

interface StockReductionFormProps {
  station: FuelStation;
  onClose: () => void;
  onSuccess: () => void;
  managerId: string;
}

export const StockReductionForm: React.FC<StockReductionFormProps> = ({ station, onClose, onSuccess, managerId }) => {
  const [fuelType, setFuelType] = useState('Petrol 92');
  const [amount, setAmount] = useState('');
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.reduceStock({
        station_id: station.id,
        fuel_type: fuelType,
        amount: parseFloat(amount),
        timestamp: new Date(timestamp).toISOString(),
        manager_id: managerId
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">End of Day Sales Entry</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
            <select 
              value={fuelType} 
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option>Petrol 92</option>
              <option>Petrol 95</option>
              <option>Diesel</option>
              <option>Super Diesel</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Sold Amount</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date & Time</label>
            <div className="relative">
              <input 
                type="datetime-local" 
                value={timestamp} 
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
              <Calendar className="absolute right-2 top-2 text-gray-400" size={20} />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Recording...' : 'Record Sales'}
          </button>
        </form>
      </div>
    </div>
  );
};
