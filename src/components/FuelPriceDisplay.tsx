import React, { useState, useEffect } from 'react';
import { api } from '../App';
import { FuelPrice } from '../types';
import { Droplets, Clock } from 'lucide-react';

export function FuelPriceDisplay() {
  const [prices, setPrices] = useState<FuelPrice | null>(null);

  useEffect(() => {
    api.getFuelPrices().then(setPrices);
  }, []);

  if (!prices) return null;

  return (
    <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5">
      <div className="flex items-center gap-3 mb-6">
        <Droplets className="w-5 h-5 text-blue-400" />
        <h3 className="text-xl font-bold">Live Fuel Prices (LKR)</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Petrol 92</p>
          <p className="text-2xl font-bold">{prices.petrol_92.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Petrol 95</p>
          <p className="text-2xl font-bold">{prices.petrol_95.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Diesel</p>
          <p className="text-2xl font-bold">{prices.diesel.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Super Diesel</p>
          <p className="text-2xl font-bold">{prices.super_diesel.toLocaleString()}</p>
        </div>
      </div>
      <div className="mt-6 pt-6 border-t border-[#141414]/5 flex items-center gap-2 text-xs opacity-40 font-bold">
        <Clock className="w-4 h-4" />
        Last Updated: {new Date(prices.last_updated).toLocaleString()}
      </div>
    </div>
  );
}
