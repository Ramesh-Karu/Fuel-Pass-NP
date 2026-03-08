import React, { useState, useMemo } from 'react';
import { Invoice, Income, Expense } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportGeneratorProps {
  invoices: Invoice[];
  income: Income[];
  expenses: Expense[];
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ invoices, income, expenses }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'All',
    category: 'All',
    paymentMethod: 'All',
    status: 'All'
  });
  const [sort, setSort] = useState({ field: 'date', direction: 'desc' });

  const allTransactions = useMemo(() => {
    const transactions = [
      ...invoices.map(i => ({ ...i, type: 'Invoice', amount: i.total_amount, status: i.status || 'Pending', station: i.station_or_distributor_name || 'N/A' })),
      ...income.map(i => ({ ...i, type: 'Income', status: 'Paid', station: 'N/A' })),
      ...expenses.map(e => ({ ...e, type: 'Expense', status: 'Paid', station: 'N/A' }))
    ];

    return transactions.filter(t => {
      const date = new Date(t.date);
      const start = filters.startDate ? new Date(filters.startDate) : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate) : new Date();
      
      return (
        (filters.type === 'All' || t.type === filters.type) &&
        (filters.category === 'All' || t.category === filters.category) &&
        (filters.paymentMethod === 'All' || t.payment_method === filters.paymentMethod) &&
        (filters.status === 'All' || t.status === filters.status) &&
        date >= start && date <= end
      );
    }).sort((a: any, b: any) => {
      const valA = a[sort.field];
      const valB = b[sort.field];
      return sort.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [invoices, income, expenses, filters, sort]);

  const totals = useMemo(() => {
    const inc = allTransactions.filter(t => t.type === 'Income' || t.type === 'Invoice').reduce((acc, t) => acc + t.amount, 0);
    const exp = allTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
    return { income: inc, expenses: exp, net: inc - exp, count: allTransactions.length };
  }, [allTransactions]);

  const exportToCSV = () => {
    const csv = allTransactions.map(t => Object.values(t).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.csv';
    a.click();
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(allTransactions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, "report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Type', 'Category', 'Amount', 'Date', 'Status']],
      body: allTransactions.map(t => [t.type, t.category, t.amount, new Date(t.date).toLocaleDateString(), t.status])
    });
    doc.save('report.pdf');
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm">
      <h2 className="text-xl font-bold">Generate Custom Report</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <input type="date" onChange={e => setFilters({...filters, startDate: e.target.value})} className="p-2 border rounded" />
        <input type="date" onChange={e => setFilters({...filters, endDate: e.target.value})} className="p-2 border rounded" />
        <select onChange={e => setFilters({...filters, type: e.target.value})} className="p-2 border rounded">
          <option value="All">All Types</option>
          <option value="Invoice">Invoice</option>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
        </select>
        <select onChange={e => setSort({...sort, field: e.target.value})} className="p-2 border rounded">
          <option value="date">Date</option>
          <option value="amount">Amount</option>
          <option value="category">Category</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button onClick={exportToCSV} className="bg-blue-600 text-white px-4 py-2 rounded">CSV</button>
        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded">Excel</button>
        <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded">PDF</button>
        <button onClick={() => window.print()} className="bg-gray-600 text-white px-4 py-2 rounded">Print</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div><p className="text-sm">Total Income</p><p className="font-bold">${totals.income.toFixed(2)}</p></div>
        <div><p className="text-sm">Total Expenses</p><p className="font-bold">${totals.expenses.toFixed(2)}</p></div>
        <div><p className="text-sm">Net Balance</p><p className="font-bold">${totals.net.toFixed(2)}</p></div>
        <div><p className="text-sm">Transactions</p><p className="font-bold">{totals.count}</p></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Type</th>
              <th className="p-2">Category</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Date</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {allTransactions.map(t => (
              <tr key={t.id} className="border-b">
                <td className="p-2">{t.type}</td>
                <td className="p-2">{t.category}</td>
                <td className="p-2">${t.amount.toFixed(2)}</td>
                <td className="p-2">{new Date(t.date).toLocaleDateString()}</td>
                <td className="p-2">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
