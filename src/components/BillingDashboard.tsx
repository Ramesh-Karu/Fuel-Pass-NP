import React, { useState, useEffect } from 'react';
import { api } from '../App';
import { Invoice, Income, Expense, User } from '../types';
import { Plus, FileText, TrendingUp, TrendingDown } from 'lucide-react';

export const BillingDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const inv = await api.getInvoices(user.station_id);
      const inc = await api.getIncome(user.station_id);
      const exp = await api.getExpenses(user.station_id);
      setInvoices(inv);
      setIncome(inc);
      setExpenses(exp);
    };
    fetchData();
  }, [user.station_id]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Billing System</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold flex items-center"><FileText className="mr-2" /> Invoices</h3>
          <p className="text-3xl font-bold">{invoices.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold flex items-center"><TrendingUp className="mr-2" /> Income</h3>
          <p className="text-3xl font-bold">{income.reduce((sum, i) => sum + i.amount, 0)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold flex items-center"><TrendingDown className="mr-2" /> Expenses</h3>
          <p className="text-3xl font-bold">{expenses.reduce((sum, e) => sum + e.amount, 0)}</p>
        </div>
      </div>
    </div>
  );
};
