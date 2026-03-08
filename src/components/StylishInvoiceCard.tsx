import React from 'react';
import { T } from '../contexts/LanguageContext';

interface InvoiceProps {
  date: string;
  time: string;
  vehicleId: string;
  amount: number;
  remainingBalance: number;
}

export const StylishInvoiceCard: React.FC<InvoiceProps> = ({ date, time, vehicleId, amount, remainingBalance }) => {
  const [email, setEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const sendInvoice = async () => {
    setSending(true);
    try {
      await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, invoiceData: { date, time, vehicleId, amount, remainingBalance } }),
      });
      alert('Invoice sent successfully!');
    } catch (error) {
      alert('Failed to send invoice.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 max-w-sm mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center"><T>Fuel Invoice</T></h2>
      <div className="space-y-4 mb-6">
        <div className="flex justify-between">
          <span className="opacity-50"><T>Date</T></span>
          <span className="font-bold">{date}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-50"><T>Time</T></span>
          <span className="font-bold">{time}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-50"><T>Vehicle</T></span>
          <span className="font-bold">{vehicleId}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-50"><T>Amount Pumped</T></span>
          <span className="font-bold text-blue-600">{amount}L</span>
        </div>
        <div className="flex justify-between pt-4 border-t">
          <span className="opacity-50"><T>Remaining Balance</T></span>
          <span className="font-bold text-green-600">{remainingBalance.toFixed(1)}L</span>
        </div>
      </div>
      <div className="space-y-2">
        <input
          type="email"
          placeholder="Enter email to send invoice"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-xl bg-gray-100"
        />
        <button
          onClick={sendInvoice}
          disabled={sending || !email}
          className="w-full p-3 bg-black text-white rounded-xl font-bold disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send Invoice'}
        </button>
      </div>
    </div>
  );
};
