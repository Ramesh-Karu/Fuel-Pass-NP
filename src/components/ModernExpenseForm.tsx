import React, { useState } from 'react';
import { User, Expense } from '../types';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const ModernExpenseForm: React.FC<{ user: User; onClose: () => void; initialData?: Expense }> = ({ user, onClose, initialData }) => {
  const [formData, setFormData] = useState<Partial<Expense>>(initialData || {
    category: 'Staff salaries',
    amount: 0,
    payment_method: 'Cash',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount as any || 0);
    if (initialData?.id) {
        await updateDoc(doc(db, 'expenses', initialData.id), { ...formData, amount });
    } else {
        const newExpense = {
          ...formData,
          expense_id: `EXP-${Date.now().toString().slice(-6)}`,
          amount,
          date: formData.date || new Date().toISOString(),
          station_id: user.station_id
        };
        await addDoc(collection(db, 'expenses'), newExpense);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Expense' : 'Record Expense'}</h3>
      <select value={formData.category} className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, category: e.target.value})}>
        <option value="Staff salaries">Staff salaries</option>
        <option value="Station maintenance">Station maintenance</option>
        <option value="Electricity bills">Electricity bills</option>
        <option value="Fuel transportation costs">Fuel transportation costs</option>
        <option value="Equipment repair">Equipment repair</option>
        <option value="Office expenses">Office expenses</option>
        <option value="Security costs">Security costs</option>
        <option value="Miscellaneous expenses">Miscellaneous expenses</option>
      </select>
      <input type="text" value={formData.amount} placeholder="Amount" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, amount: e.target.value as any})} required />
      <input type="date" value={formData.date ? formData.date.split('T')[0] : ''} className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, date: new Date(e.target.value).toISOString()})} required />
      <select value={formData.payment_method} className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, payment_method: e.target.value})}>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="Digital payments">Digital payments</option>
      </select>
      <textarea value={formData.description} placeholder="Description" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, description: e.target.value})} />
      <button type="submit" className="w-full bg-black text-white p-3 rounded-xl font-bold hover:bg-gray-800">{initialData ? 'Update Expense' : 'Record Expense'}</button>
    </form>
  );
};
