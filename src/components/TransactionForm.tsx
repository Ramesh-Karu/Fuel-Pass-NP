import React, { useState } from 'react';
import { api } from '../App';
import { User } from '../types';

export const TransactionForm: React.FC<{ 
  user: User; 
  type: 'invoice' | 'income' | 'expense'; 
  onClose: () => void 
}> = ({ user, type, onClose }) => {
  const [formData, setFormData] = useState<any>({
    category: '',
    amount: 0,
    payment_method: 'Cash',
    description: '',
    // Invoice specific
    customer_reference: '',
    station_or_distributor_name: '',
    quantity: 0,
    unit_price: 0,
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      station_id: user.station_id,
      date: new Date().toISOString()
    };
    
    if (type === 'invoice') {
      await api.createInvoice({
        ...data,
        total_amount: formData.quantity * formData.unit_price,
        status: 'Pending'
      });
    } else if (type === 'income') {
      await api.createIncome(data);
    } else {
      await api.createExpense(data);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-bold capitalize">Record {type}</h3>
      {type === 'invoice' && (
        <>
          <input type="text" placeholder="Customer Reference" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, customer_reference: e.target.value})} required />
          <input type="text" placeholder="Station/Distributor Name" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, station_or_distributor_name: e.target.value})} required />
          <input type="number" placeholder="Quantity" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} required />
          <input type="number" placeholder="Unit Price" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, unit_price: Number(e.target.value)})} required />
        </>
      )}
      <input type="text" placeholder="Category" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, category: e.target.value})} required />
      <input type="number" placeholder="Amount" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, amount: Number(e.target.value)})} required />
      <select className="w-full p-2 border rounded" onChange={e => setFormData({...formData, payment_method: e.target.value})}>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="Bank Transfer">Bank Transfer</option>
      </select>
      <input type="text" placeholder="Description/Notes" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, description: e.target.value})} />
      <button type="submit" className="w-full bg-black text-white p-2 rounded">Save {type}</button>
    </form>
  );
};
