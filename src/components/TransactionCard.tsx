import React from 'react';
import { Invoice } from '../types';

interface TransactionCardProps {
  transaction: any;
  onUpdateStatus: (id: string, status: 'Paid' | 'Pending' | 'Cancelled') => void;
  onEdit: (data: any) => void;
  onView: (data: any) => void;
  onDelete: (type: string, id: string) => void;
  onPrint: (invoice: Invoice) => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction, onUpdateStatus, onEdit, onView, onDelete, onPrint }) => {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{transaction.type}</p>
          <p className="text-sm font-bold text-gray-900">{transaction.category}</p>
        </div>
        <p className="text-lg font-bold text-gray-900">${transaction.amount.toFixed(2)}</p>
      </div>
      <p className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {transaction.type === 'Invoice' && (
          <select 
            value={(transaction as Invoice).status} 
            onChange={e => onUpdateStatus(transaction.id, e.target.value as any)}
            className="text-xs p-1.5 border rounded-lg bg-gray-50"
          >
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={() => onView(transaction)} className="text-xs text-gray-600 font-medium">View</button>
          <button onClick={() => onEdit(transaction)} className="text-xs text-indigo-600 font-medium">Edit</button>
          <button onClick={() => onDelete(transaction.type, transaction.id)} className="text-xs text-red-600 font-medium">Delete</button>
          {transaction.type === 'Invoice' && (
            <button onClick={() => onPrint(transaction as Invoice)} className="text-xs text-blue-600 font-medium">PDF</button>
          )}
        </div>
      </div>
    </div>
  );
};
