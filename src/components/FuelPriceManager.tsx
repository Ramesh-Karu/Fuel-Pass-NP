import React, { useState, useEffect } from 'react';
import { api } from '../App';
import { FuelPrice } from '../types';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export function FuelPriceManager() {
  const [prices, setPrices] = useState<FuelPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    api.getFuelPrices().then(setPrices);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prices) return;
    setLoading(true);
    try {
      await api.updateFuelPrices(prices);
      setMsg({ text: 'Fuel prices updated successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: 'Failed to update prices: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!prices) return null;

  return (
    <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5">
      <h3 className="text-2xl font-bold mb-8">Update Fuel Prices (LKR)</h3>
      
      {msg.text && (
        <div className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: 'Petrol 92', key: 'petrol_92' },
          { label: 'Petrol 95', key: 'petrol_95' },
          { label: 'Diesel', key: 'diesel' },
          { label: 'Super Diesel', key: 'super_diesel' },
        ].map(({ label, key }) => (
          <div key={key} className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">{label}</label>
            <input 
              type="number" 
              required
              className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
              value={prices[key as keyof FuelPrice]}
              onChange={(e) => setPrices({ ...prices, [key]: parseFloat(e.target.value) })}
            />
          </div>
        ))}
        
        <div className="md:col-span-2 pt-4">
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Prices'}
          </button>
        </div>
      </form>
    </div>
  );
}
