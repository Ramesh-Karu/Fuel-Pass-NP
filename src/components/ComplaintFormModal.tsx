import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../App';

interface ComplaintFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any; // Pass user if logged in
}

const COMPLAINT_TYPES = [
  'Misuse of fuel pass',
  'Illegal fuel sale',
  'Station misconduct',
  'Technical issue with the app',
  'QR scanning problem',
  'Other issue'
];

export function ComplaintFormModal({ isOpen, onClose, user }: ComplaintFormModalProps) {
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    email_phone: user?.email || user?.phone || '',
    nic: user?.nic || '',
    type: COMPLAINT_TYPES[0],
    station_location: '',
    incident_date: new Date().toISOString().slice(0, 16),
    description: '',
    consent: false
  });
  const [evidence, setEvidence] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setEvidence(prev => [...prev, ...filesArray].slice(0, 3)); // Max 3 files
    }
  };

  const removeFile = (index: number) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!formData.consent) {
      setError('You must agree to the declaration.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // In a real app, upload files to Firebase Storage here and get URLs
      // For this demo, we'll just simulate it
      const evidence_urls = evidence.map(f => URL.createObjectURL(f));

      const result = await api.createComplaint({
        ...formData,
        evidence_urls,
        user_id: user?.id || null
      });

      setSuccessId(result.complaint_id);
    } catch (err: any) {
      setError(err.message || 'Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 relative"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 border-b border-[#141414]/10 flex justify-between items-center sticky top-0 bg-white z-10">
            <h2 className="text-2xl font-bold">Register a Complaint</h2>
            {!successId && (
              <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="p-6 max-h-[80vh] overflow-y-auto">
            {successId ? (
              <div className="text-center py-12 space-y-6">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Complaint Submitted Successfully</h3>
                  <p className="text-gray-600 mb-6">Your complaint has been registered and will be reviewed shortly.</p>
                  <div className="bg-[#F5F5F0] p-6 rounded-2xl inline-block">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Your Tracking ID</p>
                    <p className="text-3xl font-mono font-bold tracking-wider">{successId}</p>
                  </div>
                </div>
                <p className="text-sm opacity-60">Please save this ID to track your complaint status.</p>
                <button 
                  onClick={onClose}
                  className="px-8 py-3 bg-[#141414] text-white rounded-xl font-bold hover:bg-opacity-90 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50">Name {!user && '(Optional)'}</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50">Email / Phone *</label>
                    <input 
                      type="text" required
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none"
                      value={formData.email_phone}
                      onChange={e => setFormData({...formData, email_phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50">NIC Number *</label>
                    <input 
                      type="text" required
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none"
                      value={formData.nic}
                      onChange={e => setFormData({...formData, nic: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50">Complaint Type *</label>
                    <select 
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none appearance-none"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                    >
                      {COMPLAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50">Station / Location (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none"
                      value={formData.station_location}
                      onChange={e => setFormData({...formData, station_location: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50">Date & Time of Incident *</label>
                    <input 
                      type="datetime-local" required
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none"
                      value={formData.incident_date}
                      onChange={e => setFormData({...formData, incident_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">Description / Details *</label>
                  <textarea 
                    required rows={4}
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl outline-none resize-none"
                    placeholder="Please provide as much detail as possible..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">Attach Evidence (Max 3)</label>
                  <div className="flex flex-wrap gap-4">
                    {evidence.map((file, i) => (
                      <div key={i} className="relative w-24 h-24 bg-[#F5F5F0] rounded-xl overflow-hidden border border-[#141414]/10">
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt="Evidence" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-center p-2 break-all">
                            {file.name}
                          </div>
                        )}
                        <button 
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {evidence.length < 3 && (
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 border-2 border-dashed border-[#141414]/20 rounded-xl flex flex-col items-center justify-center text-[#141414]/50 hover:bg-[#F5F5F0] hover:border-[#141414]/40 transition-colors"
                      >
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-xs font-bold">Upload</span>
                      </button>
                    )}
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,video/*,.pdf" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <input 
                    type="checkbox" 
                    id="consent" 
                    required
                    className="mt-1 w-4 h-4"
                    checked={formData.consent}
                    onChange={e => setFormData({...formData, consent: e.target.checked})}
                  />
                  <label htmlFor="consent" className="text-sm text-gray-600">
                    I declare that the information provided is true and accurate to the best of my knowledge. I understand that submitting false information may lead to action against me.
                  </label>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-[#141414]/10">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 font-bold opacity-60 hover:opacity-100 transition-opacity"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={loading}
                    className="px-8 py-3 bg-[#141414] text-white rounded-xl font-bold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Complaint'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
