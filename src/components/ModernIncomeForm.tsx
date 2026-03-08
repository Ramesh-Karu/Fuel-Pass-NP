import React, { useState } from 'react';
import { User, Income } from '../types';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const ModernIncomeForm: React.FC<{ user: User; onClose: () => void; initialData?: Income }> = ({ user, onClose, initialData }) => {
  const [formData, setFormData] = useState<Partial<Income>>(initialData || {
    category: 'Fuel sales',
    amount: 0,
    payment_method: 'Cash',
    description: '',
    station_reference: user.station_name || '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount as any || 0);
    if (initialData?.id) {
        await updateDoc(doc(db, 'income', initialData.id), { ...formData, amount });
    } else {
        const newIncome = {
          ...formData,
          income_id: `INC-${Date.now().toString().slice(-6)}`,
          amount,
          date: formData.date || new Date().toISOString(),
          station_id: user.station_id
        };
        await addDoc(collection(db, 'income'), newIncome);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Income' : 'Record Income'}</h3>
      <select value={formData.category} className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, category: e.target.value})}>
        <option value="Fuel sales">Fuel sales</option>
        <option value="Fuel distribution payments">Fuel distribution payments</option>
        <option value="Government subsidies">Government subsidies</option>
        <option value="Service charges">Service charges</option>
        <option value="Equipment rentals">Equipment rentals</option>
        <option value="Other revenue">Other revenue</option>
      </select>
      <input type="text" value={formData.amount} placeholder="Amount" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, amount: e.target.value as any})} required />
      <input type="date" value={formData.date ? formData.date.split('T')[0] : ''} className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, date: new Date(e.target.value).toISOString()})} required />
      <select value={formData.payment_method} className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, payment_method: e.target.value})}>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="Digital payments">Digital payments</option>
      </select>
      <input type="text" value={formData.station_reference} placeholder="Station Reference" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, station_reference: e.target.value})} />
      <textarea value={formData.description} placeholder="Description" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, description: e.target.value})} />
      <button type="submit" className="w-full bg-black text-white p-3 rounded-xl font-bold hover:bg-gray-800">{initialData ? 'Update Income' : 'Record Income'}</button>
    </form>
  );
};
