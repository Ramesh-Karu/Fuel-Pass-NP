import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../App';
import { Complaint, User } from '../types';
import { AlertCircle, CheckCircle2, Clock, FileText, MessageCircle, Plus, Search, XCircle } from 'lucide-react';

export function MyComplaintsView({ user, onBack }: { user: User, onBack: () => void }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    loadComplaints();
  }, [user.id]);

  const loadComplaints = async () => {
    try {
      const data = await api.getMyComplaints(user.id);
      setComplaints(data);
    } catch (error) {
      console.error("Error loading complaints:", error);
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
      case 'Submitted': return <FileText className="w-4 h-4" />;
      case 'Under Review': return <Search className="w-4 h-4" />;
      case 'Processing': return <Clock className="w-4 h-4" />;
      case 'Resolved': return <CheckCircle2 className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
        <button 
          onClick={() => {
            const event = new CustomEvent('open-complaint-modal');
            window.dispatchEvent(event);
          }}
          className="px-6 py-3 bg-[#141414] text-white rounded-xl font-bold text-sm hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Complaint
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-2xl font-bold mb-6">My Complaints</h2>
          
          {loading ? (
            <div className="text-center py-10 opacity-50">Loading...</div>
          ) : complaints.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl text-center border border-[#141414]/5">
              <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <p className="font-bold opacity-50">No complaints found</p>
              <p className="text-sm opacity-40 mt-1">You haven't submitted any complaints yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.map(complaint => (
                <div 
                  key={complaint.id}
                  onClick={() => setSelectedComplaint(complaint)}
                  className={`bg-white p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${selectedComplaint?.id === complaint.id ? 'border-[#141414] ring-1 ring-[#141414]' : 'border-[#141414]/5 hover:border-[#141414]/20'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-mono text-xs font-bold opacity-50">{complaint.complaint_id}</span>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusColor(complaint.status)}`}>
                      {getStatusIcon(complaint.status)}
                      {complaint.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm mb-1 line-clamp-1">{complaint.type}</h3>
                  <p className="text-xs opacity-50 mb-3 line-clamp-2">{complaint.description}</p>
                  <div className="flex justify-between items-center text-[10px] opacity-40 font-bold uppercase tracking-wider">
                    <span>{new Date(complaint.timestamp).toLocaleDateString()}</span>
                    {complaint.comments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {complaint.comments.length}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedComplaint ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={selectedComplaint.id}
              className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden sticky top-8"
            >
              <div className="p-8 border-b border-[#141414]/5 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold">{selectedComplaint.type}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusColor(selectedComplaint.status)}`}>
                      {getStatusIcon(selectedComplaint.status)}
                      {selectedComplaint.status}
                    </span>
                  </div>
                  <p className="font-mono text-sm opacity-40 font-bold">ID: {selectedComplaint.complaint_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Submitted On</p>
                  <p className="font-medium text-sm">{new Date(selectedComplaint.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">Description</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedComplaint.description}</p>
                </div>

                {selectedComplaint.station_location && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">Location</p>
                    <p className="text-sm font-medium">{selectedComplaint.station_location}</p>
                  </div>
                )}

                <div className="bg-[#F5F5F0] rounded-3xl p-6">
                  <h4 className="font-bold text-sm mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4 opacity-50" />
                    Timeline & Updates
                  </h4>
                  
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    <div className="relative pl-10">
                      <div className="absolute left-0 top-1 w-8 h-8 rounded-full border border-white bg-slate-300 text-slate-500 shadow flex items-center justify-center z-10">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-xs text-slate-900">Complaint Submitted</div>
                          <time className="text-[10px] font-medium text-slate-500">{new Date(selectedComplaint.timestamp).toLocaleDateString()}</time>
                        </div>
                        <div className="text-xs text-slate-500">Your complaint was received.</div>
                      </div>
                    </div>

                    {selectedComplaint.comments?.map((comment, idx) => (
                      <div key={idx} className="relative pl-10">
                        <div className="absolute left-0 top-1 w-8 h-8 rounded-full border border-white bg-blue-100 text-blue-500 shadow flex items-center justify-center z-10">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-bold text-xs text-slate-900">{comment.role === 'admin' ? 'Admin Update' : 'Your Comment'}</div>
                            <time className="text-[10px] font-medium text-slate-500">{new Date(comment.timestamp).toLocaleDateString()}</time>
                          </div>
                          <div className="text-xs text-slate-500">{comment.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center opacity-30 border-2 border-dashed border-[#141414]/10 rounded-[2.5rem]">
              <div>
                <FileText className="w-16 h-16 mx-auto mb-4" />
                <p className="font-bold text-lg">Select a complaint to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
