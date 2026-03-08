import React from 'react';
import { Invoice } from '../types';

interface TransactionRowProps {
  transaction: any;
  onUpdateStatus: (id: string, status: 'Paid' | 'Pending' | 'Cancelled') => void;
  onEdit: (data: any) => void;
  onView: (data: any) => void;
  onDelete: (type: string, id: string) => void;
  onPrint: (invoice: Invoice) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onUpdateStatus, onEdit, onView, onDelete, onPrint }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="p-4 text-sm text-gray-600">{transaction.type}</td>
      <td className="p-4 text-sm font-medium text-gray-900">{transaction.category}</td>
      <td className="p-4 text-sm font-semibold text-gray-900">${transaction.amount.toFixed(2)}</td>
      <td className="p-4 text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString()}</td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          {transaction.type === 'Invoice' && (
            <select 
              value={(transaction as Invoice).status} 
              onChange={e => onUpdateStatus(transaction.id, e.target.value as any)}
              className="text-xs p-1 border rounded-lg bg-white"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          )}
          <button onClick={() => onView(transaction)} className="text-xs text-gray-600 hover:text-gray-800 font-medium">View</button>
          <button onClick={() => onEdit(transaction)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
          <button onClick={() => onDelete(transaction.type, transaction.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
          {transaction.type === 'Invoice' && (
            <button onClick={() => onPrint(transaction as Invoice)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">PDF</button>
          )}
        </div>
      </td>
    </tr>
  );
};
