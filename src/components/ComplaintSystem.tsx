import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Search, FileText, Clock, MessageSquare, XCircle, Upload, ArrowLeft } from 'lucide-react';
import { Complaint, ComplaintStatus } from '../types';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function ComplaintSystem({ onBack, user }: { onBack: () => void, user?: any }) {
  const [view, setView] = useState<'menu' | 'submit' | 'track'>('menu');

  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold">Complaint Center</h2>
      </div>

      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <button
              onClick={() => setView('submit')}
              className="bg-white p-10 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all text-left group"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Submit a Complaint</h3>
              <p className="opacity-60 leading-relaxed">
                Report misuse, illegal fuel sales, station misconduct, or technical issues with the system.
              </p>
            </button>

            <button
              onClick={() => setView('track')}
              className="bg-white p-10 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all text-left group"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Track Complaint</h3>
              <p className="opacity-60 leading-relaxed">
                Check the status of an existing complaint using your Complaint ID and contact details.
              </p>
            </button>
          </motion.div>
        )}

        {view === 'submit' && (
          <motion.div
            key="submit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SubmitComplaintForm onBack={() => setView('menu')} user={user} />
          </motion.div>
        )}

        {view === 'track' && (
          <motion.div
            key="track"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TrackComplaintView onBack={() => setView('menu')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubmitComplaintForm({ onBack, user }: { onBack: () => void, user?: any }) {
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    email_phone: user?.email || user?.phone || '',
    nic: user?.nic || '',
    type: 'Misuse of fuel pass',
    station_location: '',
    incident_date: '',
    description: '',
    consent: false
  });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  const complaintTypes = [
    'Misuse of fuel pass',
    'Illegal fuel sale',
    'Station misconduct',
    'Technical issue with the app',
    'QR scanning problem',
    'Other issue'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) {
      setMsg({ text: 'You must agree to the declaration.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const complaintId = `CMP-${Math.floor(10000 + Math.random() * 90000)}`;
      
      const complaintData = {
        complaint_id: complaintId,
        name: formData.name,
        email_phone: formData.email_phone,
        nic: formData.nic,
        type: formData.type,
        station_location: formData.station_location,
        incident_date: formData.incident_date,
        description: formData.description,
        status: 'Submitted',
        timestamp: new Date().toISOString(),
        user_id: user?.id || null,
        comments: []
      };

      await addDoc(collection(db, 'complaints'), complaintData);
      
      setSubmittedId(complaintId);
      setMsg({ text: 'Your complaint has been submitted successfully.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'An error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (submittedId) {
    return (
      <div className="bg-white rounded-[2.5rem] shadow-xl p-12 text-center">
        <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Complaint Submitted</h2>
        <p className="text-lg opacity-60 mb-8">Your complaint has been submitted successfully.</p>
        
        <div className="bg-[#F5F5F0] p-8 rounded-3xl inline-block mb-10">
          <p className="text-sm font-bold uppercase tracking-widest opacity-40 mb-2">Your Complaint ID</p>
          <p className="text-4xl font-bold tracking-wider">{submittedId}</p>
        </div>
        
        <p className="text-sm opacity-50 mb-10 max-w-md mx-auto">
          Please save this ID. You will need it along with your contact details to track the status of your complaint.
        </p>

        <button 
          onClick={onBack}
          className="px-8 py-4 bg-[#141414] text-white rounded-2xl font-bold hover:bg-opacity-90 transition-all"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
      <div className="p-10">
        <h3 className="text-2xl font-bold mb-8">Submit a Complaint</h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {msg.text && (
            <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {msg.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Name (Optional)</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Email / Phone Number *</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.email_phone}
                onChange={e => setFormData({...formData, email_phone: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">NIC Number *</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.nic}
                onChange={e => setFormData({...formData, nic: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Complaint Type *</label>
              <select 
                required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                {complaintTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Station / Location (Optional)</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.station_location}
                onChange={e => setFormData({...formData, station_location: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Date and Time of Incident *</label>
              <input 
                type="datetime-local" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.incident_date}
                onChange={e => setFormData({...formData, incident_date: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Description / Details *</label>
            <textarea 
              required rows={5}
              className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none resize-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Please provide as much detail as possible..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Attach Evidence (Optional)</label>
            <div className="w-full px-6 py-8 bg-[#F5F5F0] rounded-2xl border-2 border-dashed border-[#141414]/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#141414]/5 transition-colors">
              <Upload className="w-8 h-8 opacity-40 mb-2" />
              <p className="font-bold text-sm">Click to upload photos, videos, or documents</p>
              <p className="text-xs opacity-50 mt-1">Max file size: 10MB</p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-4">
            <input 
              type="checkbox" 
              id="consent"
              className="mt-1 w-5 h-5 rounded border-gray-300 text-[#141414] focus:ring-[#141414]"
              checked={formData.consent}
              onChange={e => setFormData({...formData, consent: e.target.checked})}
            />
            <label htmlFor="consent" className="text-sm opacity-70 leading-relaxed">
              I declare that the information provided is true and accurate to the best of my knowledge. I understand that submitting false complaints may lead to action against me.
            </label>
          </div>

          <div className="pt-6 border-t border-[#141414]/10 flex justify-end gap-4">
            <button 
              type="button"
              onClick={onBack}
              className="px-8 py-4 font-bold opacity-50 hover:opacity-100 transition-opacity"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-10 py-4 bg-[#141414] text-white rounded-2xl font-bold hover:bg-opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TrackComplaintView({ onBack }: { onBack: () => void }) {
  const [searchData, setSearchData] = useState({ id: '', contact: '', nic: '' });
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setComplaint(null);

    try {
      const q = query(
        collection(db, 'complaints'), 
        where('complaint_id', '==', searchData.id),
        where('nic', '==', searchData.nic),
        where('email_phone', '==', searchData.contact)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError('No complaint found with these details. Please check your information and try again.');
      } else {
        setComplaint({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Complaint);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Submitted': return 'bg-gray-100 text-gray-600';
      case 'Under Review': return 'bg-blue-100 text-blue-600';
      case 'Processing': return 'bg-orange-100 text-orange-600';
      case 'Resolved': return 'bg-green-100 text-green-600';
      case 'Rejected': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="p-10">
          <h3 className="text-2xl font-bold mb-8">Track Your Complaint</h3>
          
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Complaint ID</label>
              <input 
                type="text" required
                placeholder="e.g. CMP-12345"
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={searchData.id}
                onChange={e => setSearchData({...searchData, id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Mobile / Email</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={searchData.contact}
                onChange={e => setSearchData({...searchData, contact: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">NIC Number</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={searchData.nic}
                onChange={e => setSearchData({...searchData, nic: e.target.value})}
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button 
                type="submit"
                disabled={loading}
                className="px-10 py-4 bg-[#141414] text-white rounded-2xl font-bold hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                {loading ? 'Searching...' : 'Track Status'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>
      </div>

      {complaint && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden"
        >
          <div className="p-10 border-b border-[#141414]/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest opacity-40 mb-1">Complaint Details</p>
              <h3 className="text-3xl font-bold">{complaint.complaint_id}</h3>
            </div>
            <div className={`px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wider ${getStatusColor(complaint.status)}`}>
              {complaint.status}
            </div>
          </div>
          
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">Category</p>
                <p className="font-medium text-lg">{complaint.type}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">Submitted On</p>
                <p className="font-medium">{new Date(complaint.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">Description</p>
                <p className="opacity-80 leading-relaxed whitespace-pre-wrap">{complaint.description}</p>
              </div>
            </div>

            <div className="bg-[#F5F5F0] rounded-3xl p-8">
              <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 opacity-50" />
                Timeline & Updates
              </h4>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm text-slate-900">Complaint Submitted</div>
                      <time className="text-xs font-medium text-slate-500">{new Date(complaint.timestamp).toLocaleDateString()}</time>
                    </div>
                    <div className="text-xs text-slate-500">Your complaint was received.</div>
                  </div>
                </div>

                {complaint.comments?.map((comment, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-blue-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-sm text-slate-900">{comment.role === 'admin' ? 'Admin Update' : 'Your Comment'}</div>
                        <time className="text-xs font-medium text-slate-500">{new Date(comment.timestamp).toLocaleDateString()}</time>
                      </div>
                      <div className="text-xs text-slate-500">{comment.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
