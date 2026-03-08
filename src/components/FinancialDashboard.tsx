import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Invoice, Income, Expense } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ModernInvoiceForm } from './ModernInvoiceForm';
import { ModernIncomeForm } from './ModernIncomeForm';
import { ModernExpenseForm } from './ModernExpenseForm';
import { ReportGenerator } from './ReportGenerator';
import { TransactionRow } from './TransactionRow';
import { TransactionCard } from './TransactionCard';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl text-sm">
        <p className="font-semibold text-gray-700">{label || payload[0].payload.name}</p>
        <p className="text-indigo-600 font-bold">Rs {payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

export function FinancialDashboard({ user }: { user: User }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<'invoice' | 'income' | 'expense' | null>(null);
  const [activeItem, setActiveItem] = useState<{type: 'invoice' | 'income' | 'expense', data: any, mode: 'view' | 'edit'} | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions'>('dashboard');
  const [showReports, setShowReports] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Invoice' | 'Income' | 'Expense'>('All');

  useEffect(() => {
    console.log("FinancialDashboard: user =", user);
    if (!user) {
      console.log("FinancialDashboard: No user, setting loading to false");
      setLoading(false);
      return;
    }
    
    // If admin, we might want to see all data or handle it differently.
    // For now, let's assume admin sees all stations' data.
    const isAdmin = user.role === 'admin';
    
    const qInvoices = isAdmin 
      ? query(collection(db, 'invoices'))
      : query(collection(db, 'invoices'), where('station_id', '==', user.station_id));
    const qIncome = isAdmin
      ? query(collection(db, 'income'))
      : query(collection(db, 'income'), where('station_id', '==', user.station_id));
    const qExpenses = isAdmin
      ? query(collection(db, 'expenses'))
      : query(collection(db, 'expenses'), where('station_id', '==', user.station_id));
      
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      console.log("Invoices loaded:", snapshot.docs.length);
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    });
    const unsubIncome = onSnapshot(qIncome, (snapshot) => {
      console.log("Income loaded:", snapshot.docs.length);
      setIncome(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income)));
    });
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      console.log("Expenses loaded:", snapshot.docs.length);
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });
    setLoading(false);
    return () => { unsubInvoices(); unsubIncome(); unsubExpenses(); };
  }, [user]);

  const allTransactions = useMemo(() => {
    const transactions = [
      ...invoices.map(i => ({ ...i, type: 'Invoice', amount: i.total_amount })),
      ...income.map(i => ({ ...i, type: 'Income' })),
      ...expenses.map(e => ({ ...e, type: 'Expense' }))
    ];
    return transactions.filter(t => 
      (filterType === 'All' || t.type === filterType) &&
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, income, expenses, filterType, searchTerm]);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(allTransactions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, "Transactions.xlsx");
  };

  const printInvoice = (invoice: Invoice) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Financial Tool Branding', 10, 10);
    doc.setFontSize(12);
    doc.text(`Invoice ID: ${invoice.invoice_id}`, 10, 20);
    doc.text(`Customer: ${invoice.customer_reference}`, 10, 30);
    doc.text(`Total Amount: Rs ${invoice.total_amount.toFixed(2)}`, 10, 40);
    doc.save(`Invoice_${invoice.invoice_id}.pdf`);
  };

  const updateInvoiceStatus = async (id: string, status: 'Paid' | 'Pending' | 'Cancelled') => {
    await updateDoc(doc(db, 'invoices', id), { status });
  };

  const deleteTransaction = async (type: string, id: string) => {
    if (confirm(`Are you sure you want to delete this ${type}?`)) {
      await deleteDoc(doc(db, type === 'Invoice' ? 'invoices' : type === 'Income' ? 'income' : 'expenses', id));
    }
  };

  if (loading) return <div>Loading...</div>;

  const totalIncome = income.reduce((acc, i) => acc + i.amount, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const barData = [
    { name: 'Income', amount: totalIncome },
    { name: 'Expenses', amount: totalExpenses },
    { name: 'Net Profit', amount: netProfit },
  ];

  const pieData = [
    { name: 'Income', value: totalIncome },
    { name: 'Expenses', value: totalExpenses },
  ];

  const lineData = allTransactions.slice(0, 10).reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString(),
    amount: t.amount
  }));

  const COLORS = ['#10B981', '#EF4444'];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Financial Dashboard</h2>
      
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button onClick={() => setActiveTab('dashboard')} className={`pb-2 ${activeTab === 'dashboard' ? 'border-b-2 border-indigo-600 font-bold text-indigo-600' : 'text-gray-500'}`}>Dashboard</button>
        <button onClick={() => setActiveTab('transactions')} className={`pb-2 ${activeTab === 'transactions' ? 'border-b-2 border-indigo-600 font-bold text-indigo-600' : 'text-gray-500'}`}>Transactions</button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-green-100 p-6 rounded-xl">
              <h3 className="text-lg font-bold">Total Income</h3>
              <p className="text-3xl font-bold">Rs {totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-red-100 p-6 rounded-xl">
              <h3 className="text-lg font-bold">Total Expenses</h3>
              <p className="text-3xl font-bold">Rs {totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-blue-100 p-6 rounded-xl">
              <h3 className="text-lg font-bold">Net Profit/Loss</h3>
              <p className="text-3xl font-bold">Rs {netProfit.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <button onClick={() => setShowForm('invoice')} className="bg-white border border-gray-200 text-gray-900 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-all shadow-sm">New Invoice</button>
            <button onClick={() => setShowForm('income')} className="bg-white border border-gray-200 text-gray-900 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-all shadow-sm">Record Income</button>
            <button onClick={() => setShowForm('expense')} className="bg-white border border-gray-200 text-gray-900 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-all shadow-sm">Record Expense</button>
            <button onClick={exportToExcel} className="bg-white border border-gray-200 text-gray-900 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-all shadow-sm">Export to Excel</button>
            <button onClick={() => setShowReports(!showReports)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
              {showReports ? 'Back to Dashboard' : 'View Reports'}
            </button>
            <button onClick={async () => {
                try {
                    await fetch('/api/send-sample-invoice', { method: 'POST' });
                    alert('Sample invoice sent!');
                } catch (e) {
                    alert('Failed to send sample invoice');
                }
            }} className="bg-gray-800 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-gray-900 transition-all shadow-md">
              Send Sample Invoice
            </button>
          </div>

          {showReports ? (
            <ReportGenerator invoices={invoices} income={income} expenses={expenses} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-64 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold mb-2">Income vs Expenses</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                            <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="h-64 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold mb-2">Income vs Expenses (Pie)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} cornerRadius={10}>
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="h-64 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold mb-2">Recent Transactions Trend</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} dot={{r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff'}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4">
            <input type="text" placeholder="Search transactions..." className="flex-grow p-2 border rounded" onChange={e => setSearchTerm(e.target.value)} />
            <select className="p-2 border rounded" onChange={e => setFilterType(e.target.value as any)}>
              <option value="All">All Types</option>
              <option value="Invoice">Invoice</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4">Type</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allTransactions.map(t => (
                  <TransactionRow 
                    key={t.id} 
                    transaction={t} 
                    onUpdateStatus={updateInvoiceStatus} 
                    onEdit={(data) => setActiveItem({type: t.type.toLowerCase() as any, data, mode: 'edit'})} 
                    onView={(data) => setActiveItem({type: t.type.toLowerCase() as any, data, mode: 'view'})}
                    onDelete={deleteTransaction}
                    onPrint={printInvoice}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-4">
            {allTransactions.map(t => (
              <TransactionCard 
                key={t.id} 
                transaction={t} 
                onUpdateStatus={updateInvoiceStatus} 
                onEdit={(data) => setActiveItem({type: t.type.toLowerCase() as any, data, mode: 'edit'})} 
                onView={(data) => setActiveItem({type: t.type.toLowerCase() as any, data, mode: 'view'})}
                onDelete={deleteTransaction}
                onPrint={printInvoice}
              />
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-gray-100">
            {showForm === 'invoice' && <ModernInvoiceForm user={user} onClose={() => setShowForm(null)} />}
            {showForm === 'income' && <ModernIncomeForm user={user} onClose={() => setShowForm(null)} />}
            {showForm === 'expense' && <ModernExpenseForm user={user} onClose={() => setShowForm(null)} />}
            <button onClick={() => setShowForm(null)} className="mt-6 w-full text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {activeItem && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-gray-100">
            {activeItem.mode === 'view' ? (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">View {activeItem.type}</h3>
                    <p><strong>Category:</strong> {activeItem.data.category}</p>
                    <p><strong>Amount:</strong> Rs {activeItem.data.amount.toFixed(2)}</p>
                    <p><strong>Date:</strong> {new Date(activeItem.data.date).toLocaleDateString()}</p>
                    <button onClick={() => setActiveItem(null)} className="w-full bg-gray-100 text-gray-900 p-3 rounded-xl font-bold hover:bg-gray-200">Close</button>
                </div>
            ) : (
                <>
                    {activeItem.type === 'invoice' && <ModernInvoiceForm user={user} onClose={() => setActiveItem(null)} initialData={activeItem.data} />}
                    {activeItem.type === 'income' && <ModernIncomeForm user={user} onClose={() => setActiveItem(null)} initialData={activeItem.data} />}
                    {activeItem.type === 'expense' && <ModernExpenseForm user={user} onClose={() => setActiveItem(null)} initialData={activeItem.data} />}
                    <button onClick={() => setActiveItem(null)} className="mt-6 w-full text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
