import React, { useState } from 'react';
import { api } from '../App';
import { User } from '../types';

export const IncomeForm: React.FC<{ user: User; onClose: () => void }> = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    category: '',
    amount: 0,
    payment_method: 'Cash',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createIncome({
      ...formData,
      station_id: user.station_id
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" placeholder="Category" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, category: e.target.value})} required />
      <input type="number" placeholder="Amount" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, amount: Number(e.target.value)})} required />
      <select className="w-full p-2 border rounded" onChange={e => setFormData({...formData, payment_method: e.target.value})}>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="Bank Transfer">Bank Transfer</option>
      </select>
      <input type="text" placeholder="Description" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, description: e.target.value})} required />
      <button type="submit" className="w-full bg-black text-white p-2 rounded">Record Income</button>
    </form>
  );
};
