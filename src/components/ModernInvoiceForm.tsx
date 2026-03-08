import React, { useState } from 'react';
import { User, Invoice } from '../types';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const ModernInvoiceForm: React.FC<{ user: User; onClose: () => void; initialData?: Invoice }> = ({ user, onClose, initialData }) => {
  const [formData, setFormData] = useState<Partial<Invoice>>(initialData || {
    customer_reference: '',
    station_or_distributor_name: user.station_name || '',
    category: '',
    quantity: 0,
    unit_price: 0,
    payment_method: 'Cash',
    notes: '',
    status: 'Pending',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting invoice:", formData);
    const quantity = parseFloat(formData.quantity as any || 0);
    const unit_price = parseFloat(formData.unit_price as any || 0);
    const total_amount = quantity * unit_price;
    
    try {
        if (initialData?.id) {
            await updateDoc(doc(db, 'invoices', initialData.id), { ...formData, total_amount, quantity, unit_price });
        } else {
            const newInvoice = {
              ...formData,
              invoice_id: `INV-${Date.now().toString().slice(-6)}`,
              total_amount,
              quantity,
              unit_price,
              date: formData.date || new Date().toISOString(),
              station_id: user.station_id
            };
            console.log("Adding new invoice to Firestore:", newInvoice);
            await addDoc(collection(db, 'invoices'), newInvoice);
            console.log("Invoice added successfully");
        }
        onClose();
    } catch (error) {
        console.error("Error creating/updating invoice:", error);
        alert("Error creating invoice. Check console for details.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Invoice' : 'New Invoice'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <input type="text" value={formData.customer_reference} placeholder="Customer Reference" className="p-3 border rounded-xl" onChange={e => setFormData({...formData, customer_reference: e.target.value})} required />
        <input type="text" value={formData.station_or_distributor_name} placeholder="Station/Distributor" className="p-3 border rounded-xl" onChange={e => setFormData({...formData, station_or_distributor_name: e.target.value})} required />
        <input type="text" value={formData.category} placeholder="Category" className="p-3 border rounded-xl" onChange={e => setFormData({...formData, category: e.target.value})} required />
        <input type="text" value={formData.quantity} placeholder="Quantity" className="p-3 border rounded-xl" onChange={e => setFormData({...formData, quantity: e.target.value as any})} required />
        <input type="text" value={formData.unit_price} placeholder="Unit Price" className="p-3 border rounded-xl" onChange={e => setFormData({...formData, unit_price: e.target.value as any})} required />
        <input type="date" value={formData.date ? formData.date.split('T')[0] : ''} className="p-3 border rounded-xl" onChange={e => setFormData({...formData, date: new Date(e.target.value).toISOString()})} required />
        <select value={formData.payment_method} className="p-3 border rounded-xl" onChange={e => setFormData({...formData, payment_method: e.target.value})}>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
        <select value={formData.status} className="p-3 border rounded-xl" onChange={e => setFormData({...formData, status: e.target.value as any})}>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      <textarea value={formData.notes} placeholder="Notes" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, notes: e.target.value})} />
      <button type="submit" className="w-full bg-black text-white p-3 rounded-xl font-bold hover:bg-gray-800">{initialData ? 'Update Invoice' : 'Create Invoice'}</button>
    </form>
  );
};
