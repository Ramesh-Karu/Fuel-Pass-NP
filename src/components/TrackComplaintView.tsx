import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle2, Clock, XCircle, FileText, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../App';
import { Complaint } from '../types';

export function TrackComplaintView({ onBack }: { onBack?: () => void }) {
  const [complaintId, setComplaintId] = useState('');
  const [phoneOrNic, setPhoneOrNic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complaint, setComplaint] = useState<Complaint | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintId || !phoneOrNic) return;
    
    setLoading(true);
    setError('');
    setComplaint(null);

    try {
      const result = await api.getComplaintByTracking(complaintId, phoneOrNic);
      if (result) {
        setComplaint(result);
      } else {
        setError('No complaint found with the provided details. Please check your Complaint ID and NIC/Phone number.');
      }
    } catch (err: any) {
      setError('An error occurred while tracking the complaint.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted': return 'bg-gray-100 text-gray-600';
      case 'Under Review': return 'bg-blue-100 text-blue-600';
      case 'Processing': return 'bg-orange-100 text-orange-600';
      case 'Resolved': return 'bg-green-100 text-green-600';
      case 'Rejected': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Submitted': return <FileText className="w-5 h-5" />;
      case 'Under Review': return <Search className="w-5 h-5" />;
      case 'Processing': return <Clock className="w-5 h-5" />;
      case 'Resolved': return <CheckCircle2 className="w-5 h-5" />;
      case 'Rejected': return <XCircle className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12">
      {onBack && (
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
      )}
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="p-10 border-b border-[#141414]/10">
          <h2 className="text-3xl font-bold mb-2">Track Your Complaint</h2>
          <p className="text-gray-500">Enter your Complaint ID and the NIC or Phone number used during submission.</p>
        </div>

        <div className="p-10">
          <form onSubmit={handleSearch} className="space-y-6 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">Complaint ID</label>
                <input 
                  type="text" required
                  placeholder="e.g. CMP-12345"
                  className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none uppercase"
                  value={complaintId}
                  onChange={e => setComplaintId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">NIC or Phone Number</label>
                <input 
                  type="text" required
                  placeholder="Enter NIC or Phone"
                  className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={phoneOrNic}
                  onChange={e => setPhoneOrNic(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading || !complaintId || !phoneOrNic}
              className="w-full py-4 bg-[#141414] text-white rounded-2xl font-bold hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Searching...' : (
                <>
                  <Search className="w-5 h-5" />
                  Track Status
                </>
              )}
            </button>
          </form>

          {complaint && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#F5F5F0]/50 rounded-3xl p-8 border border-[#141414]/5 space-y-8"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#141414]/10 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Complaint ID</p>
                  <h3 className="text-2xl font-mono font-bold">{complaint.complaint_id}</h3>
                </div>
                <div className={`px-4 py-2 rounded-full flex items-center gap-2 font-bold text-sm ${getStatusColor(complaint.status)}`}>
                  {getStatusIcon(complaint.status)}
                  {complaint.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Category</p>
                  <p className="font-medium">{complaint.type}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Submission Date</p>
                  <p className="font-medium">{new Date(complaint.timestamp).toLocaleString()}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{complaint.description}</p>
                </div>
              </div>

              {complaint.comments && complaint.comments.length > 0 && (
                <div className="border-t border-[#141414]/10 pt-6 space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 opacity-50" />
                    Updates & Comments
                  </h4>
                  <div className="space-y-4">
                    {complaint.comments.map((comment, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl ${comment.role === 'admin' ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-[#141414]/10'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs font-bold uppercase tracking-wider ${comment.role === 'admin' ? 'text-blue-600' : 'opacity-50'}`}>
                            {comment.role === 'admin' ? 'Admin Update' : 'Your Comment'}
                          </span>
                          <span className="text-xs opacity-50">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
