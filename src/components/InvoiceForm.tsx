import React, { useState } from 'react';
import { api } from '../App';
import { User } from '../types';

export const InvoiceForm: React.FC<{ user: User; onClose: () => void }> = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    customer_reference: '',
    station_or_distributor_name: '',
    category: '',
    quantity: 0,
    unit_price: 0,
    payment_method: 'Cash',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createInvoice({
      ...formData,
      total_amount: formData.quantity * formData.unit_price,
      status: 'Pending',
      station_id: user.station_id
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" placeholder="Customer Reference" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, customer_reference: e.target.value})} required />
      <input type="text" placeholder="Station/Distributor Name" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, station_or_distributor_name: e.target.value})} required />
      <input type="text" placeholder="Category" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, category: e.target.value})} required />
      <input type="number" placeholder="Quantity" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} required />
      <input type="number" placeholder="Unit Price" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, unit_price: Number(e.target.value)})} required />
      <select className="w-full p-2 border rounded" onChange={e => setFormData({...formData, payment_method: e.target.value})}>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="Bank Transfer">Bank Transfer</option>
      </select>
      <textarea placeholder="Notes" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, notes: e.target.value})} />
      <button type="submit" className="w-full bg-black text-white p-2 rounded">Create Invoice</button>
    </form>
  );
};
