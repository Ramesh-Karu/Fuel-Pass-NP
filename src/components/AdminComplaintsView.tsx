import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../App';
import { Complaint, ComplaintStatus, User } from '../types';
import { AlertCircle, CheckCircle2, Clock, FileText, MessageCircle, Search, XCircle, Filter, ChevronDown, Send } from 'lucide-react';

export function AdminComplaintsView({ user }: { user: User }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [commentText, setCommentText] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadComplaints();
  }, []);

  useEffect(() => {
    filterComplaints();
  }, [complaints, filterStatus, searchQuery]);

  const loadComplaints = async () => {
    try {
      const data = await api.getAllComplaints();
      setComplaints(data);
    } catch (error) {
      console.error("Error loading complaints:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaints = () => {
    let result = complaints;

    if (filterStatus !== 'All') {
      result = result.filter(c => c.status === filterStatus);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.complaint_id.toLowerCase().includes(q) ||
        c.nic.toLowerCase().includes(q) ||
        c.email_phone.toLowerCase().includes(q)
      );
    }

    setFilteredComplaints(result);
  };

  const handleStatusUpdate = async (newStatus: ComplaintStatus) => {
    if (!selectedComplaint) return;
    setUpdating(true);
    try {
      await api.updateComplaintStatus(selectedComplaint.id, newStatus, undefined, user.id);
      
      // Update local state
      const updatedComplaint = { ...selectedComplaint, status: newStatus };
      setComplaints(complaints.map(c => c.id === selectedComplaint.id ? updatedComplaint : c));
      setSelectedComplaint(updatedComplaint);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !commentText.trim()) return;
    
    setUpdating(true);
    try {
      await api.addComplaintComment(selectedComplaint.id, commentText, user.id, 'admin');
      
      // Reload to get updated comments
      const data = await api.getAllComplaints();
      setComplaints(data);
      const updated = data.find(c => c.id === selectedComplaint.id);
      if (updated) setSelectedComplaint(updated);
      
      setCommentText('');
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    } finally {
      setUpdating(false);
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

  if (!user) {
    return <div className="p-8 text-center opacity-50">Loading user profile...</div>;
  }

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Complaints</h2>
          <p className="text-sm opacity-40 font-medium uppercase tracking-widest mt-1">Manage user grievances & feedback</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text" 
              placeholder="Search ID, NIC, Email..." 
              className="w-full pl-11 pr-4 py-3 bg-white/50 backdrop-blur-md rounded-2xl border border-[#141414]/5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative flex-1 md:flex-none">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <select 
              className="w-full pl-11 pr-10 py-3 bg-white/50 backdrop-blur-md rounded-2xl border border-[#141414]/5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black/5 appearance-none cursor-pointer transition-all"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Processing">Processing</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 relative">
        {/* List Column */}
        <div className={`lg:col-span-4 bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5 overflow-hidden flex flex-col ${selectedComplaint ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-6 border-b border-[#141414]/5 bg-white/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest opacity-40">{filteredComplaints.length} Records</p>
              {loading && <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <Clock className="w-10 h-10 mb-4 animate-pulse" />
                <p className="text-sm font-bold uppercase tracking-widest">Loading...</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="text-center py-20 opacity-20 italic text-sm">No matching complaints</div>
            ) : (
              filteredComplaints.map(complaint => (
                <button 
                  key={complaint.id}
                  onClick={() => setSelectedComplaint(complaint)}
                  className={`w-full p-5 rounded-[2rem] border text-left transition-all group ${
                    selectedComplaint?.id === complaint.id 
                      ? 'bg-[#141414] border-[#141414] text-white shadow-lg shadow-black/10' 
                      : 'bg-white border-[#141414]/5 hover:border-[#141414]/20 hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`font-mono text-[10px] font-bold tracking-tighter ${selectedComplaint?.id === complaint.id ? 'opacity-60' : 'opacity-30'}`}>
                      #{complaint.complaint_id}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                      selectedComplaint?.id === complaint.id 
                        ? 'bg-white/10 text-white' 
                        : getStatusColor(complaint.status)
                    }`}>
                      {complaint.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm mb-1 line-clamp-1">{complaint.type}</h3>
                  <p className={`text-xs mb-3 line-clamp-1 ${selectedComplaint?.id === complaint.id ? 'opacity-60' : 'opacity-40'}`}>
                    {complaint.nic}
                  </p>
                  <div className={`flex justify-between items-center text-[9px] font-bold uppercase tracking-widest ${selectedComplaint?.id === complaint.id ? 'opacity-40' : 'opacity-20'}`}>
                    <span>{new Date(complaint.timestamp).toLocaleDateString()}</span>
                    <span>{complaint.comments?.length || 0} Comments</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail Column */}
        <div className={`lg:col-span-8 bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5 overflow-hidden flex flex-col absolute inset-0 lg:static z-20 lg:z-auto ${selectedComplaint ? 'flex' : 'hidden lg:flex'}`}>
          {selectedComplaint ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-8 border-b border-[#141414]/5 bg-white/50 backdrop-blur-md">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <button 
                        onClick={() => setSelectedComplaint(null)}
                        className="lg:hidden p-2 hover:bg-[#141414]/5 rounded-xl transition-colors"
                      >
                        <ChevronDown className="w-6 h-6 rotate-90 opacity-40" />
                      </button>
                      <h3 className="text-2xl font-bold tracking-tight">{selectedComplaint.type}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusColor(selectedComplaint.status)}`}>
                        {selectedComplaint.status}
                      </span>
                      <span className="w-1 h-1 bg-[#141414]/10 rounded-full" />
                      <span className="font-mono text-xs font-bold opacity-30">ID: {selectedComplaint.complaint_id}</span>
                      <span className="w-1 h-1 bg-[#141414]/10 rounded-full" />
                      <span className="text-xs font-bold opacity-30 uppercase tracking-widest">{new Date(selectedComplaint.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-[#F5F5F0] p-2 rounded-2xl border border-[#141414]/5 w-full md:w-auto">
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest ml-2">Status</span>
                    <select 
                      className="flex-1 md:flex-none px-4 py-2 bg-white rounded-xl border border-[#141414]/5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black/5 cursor-pointer transition-all"
                      value={selectedComplaint.status}
                      onChange={(e) => handleStatusUpdate(e.target.value as ComplaintStatus)}
                      disabled={updating}
                    >
                      <option value="Submitted">Submitted</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Processing">Processing</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className="md:col-span-7 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-4">Description</h4>
                      <div className="bg-white p-6 rounded-[2rem] border border-[#141414]/5 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-80">
                          {selectedComplaint.description}
                        </p>
                      </div>
                    </div>
                    
                    {selectedComplaint.evidence_urls && selectedComplaint.evidence_urls.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-4">Evidence Attachments</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {selectedComplaint.evidence_urls.map((url, i) => (
                            <a 
                              key={i} 
                              href={url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="group flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-[#141414]/5 hover:border-blue-500 transition-all text-center"
                            >
                              <FileText className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:text-blue-500 transition-all mb-2" />
                              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 group-hover:text-blue-600">File {i + 1}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-5 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-4">User Information</h4>
                      <div className="bg-[#141414]/5 p-6 rounded-[2rem] space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">NIC Number</span>
                          <span className="text-sm font-bold">{selectedComplaint.nic}</span>
                        </div>
                        <div className="w-full h-px bg-[#141414]/5" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Contact</span>
                          <span className="text-sm font-bold">{selectedComplaint.email_phone}</span>
                        </div>
                        <div className="w-full h-px bg-[#141414]/5" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Location</span>
                          <span className="text-sm font-bold text-right">{selectedComplaint.station_location || 'Not Specified'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Discussion History</h4>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 bg-[#141414]/5 px-3 py-1 rounded-full">
                      {selectedComplaint.comments?.length || 0} Messages
                    </span>
                  </div>
                  
                  <div className="space-y-6">
                    {selectedComplaint.comments?.map((comment, idx) => (
                      <div key={idx} className={`flex gap-4 ${comment.role === 'admin' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                          comment.role === 'admin' ? 'bg-[#141414] text-white' : 'bg-white border border-[#141414]/5 text-[#141414]'
                        }`}>
                          {comment.role === 'admin' ? 'A' : 'U'}
                        </div>
                        <div className={`max-w-[80%] flex flex-col ${comment.role === 'admin' ? 'items-end' : 'items-start'}`}>
                          <div className={`p-5 rounded-[1.5rem] text-sm shadow-sm ${
                            comment.role === 'admin' 
                              ? 'bg-[#141414] text-white rounded-tr-none' 
                              : 'bg-white border border-[#141414]/5 rounded-tl-none'
                          }`}>
                            <p className="leading-relaxed">{comment.text}</p>
                          </div>
                          <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-2 px-2">
                            {new Date(comment.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!selectedComplaint.comments || selectedComplaint.comments.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-20">
                        <MessageCircle className="w-10 h-10 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No conversation history</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/80 backdrop-blur-md border-t border-[#141414]/5">
                <form onSubmit={handleAddComment} className="flex items-center gap-3 bg-[#F5F5F0] p-2 rounded-[2rem] border border-[#141414]/5">
                  <input 
                    type="text" 
                    placeholder="Add a response or internal note..." 
                    className="flex-1 px-6 py-3 bg-transparent outline-none text-sm font-medium"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    disabled={updating}
                  />
                  <button 
                    type="submit"
                    disabled={!commentText.trim() || updating}
                    className="p-4 bg-[#141414] text-white rounded-2xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-[#141414]/5 rounded-[2.5rem] flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 opacity-20" />
              </div>
              <h3 className="text-xl font-bold mb-2">Complaint Details</h3>
              <p className="text-sm opacity-40 max-w-xs mx-auto">
                Select a complaint from the list to view full details, evidence, and manage the resolution process.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
