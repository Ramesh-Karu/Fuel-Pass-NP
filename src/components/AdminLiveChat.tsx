import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, User as UserIcon, X, ImageIcon, MessageCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  sender: 'user' | 'ai' | 'admin';
  text: string;
  image_url?: string;
  timestamp: any;
  status: 'unread' | 'read';
}

interface ChatSession {
  userId: string;
  lastMessage: string;
  timestamp: any;
  unreadCount: number;
}

export function AdminLiveChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch unique sessions
  useEffect(() => {
    const q = query(collection(db, 'chat_messages'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      
      const sessionMap = new Map<string, ChatSession>();
      msgs.forEach(msg => {
        if (!sessionMap.has(msg.user_id)) {
          sessionMap.set(msg.user_id, {
            userId: msg.user_id,
            lastMessage: msg.text,
            timestamp: msg.timestamp,
            unreadCount: 0
          });
        }
        if (msg.status === 'unread' && msg.sender === 'user') {
          const session = sessionMap.get(msg.user_id)!;
          session.unreadCount += 1;
        }
      });

      setSessions(Array.from(sessionMap.values()));
    });

    return () => unsubscribe();
  }, []);

  // Fetch messages for active session
  useEffect(() => {
    if (!activeSession) return;

    const q = query(
      collection(db, 'chat_messages'),
      where('user_id', '==', activeSession),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // Mark unread messages as read
      msgs.forEach(msg => {
        if (msg.sender === 'user' && msg.status === 'unread') {
          updateDoc(doc(db, 'chat_messages', msg.id), { status: 'read' });
        }
      });
    });

    return () => unsubscribe();
  }, [activeSession]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !image) || !activeSession) return;

    const adminText = input.trim();
    const currentImage = image;
    setInput('');
    setImage(null);

    try {
      await addDoc(collection(db, 'chat_messages'), {
        user_id: activeSession,
        sender: 'admin',
        text: adminText,
        image_url: currentImage || null,
        timestamp: serverTimestamp(),
        status: 'read'
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5 overflow-hidden flex h-[700px]">
      {/* Sidebar */}
      <div className="w-80 border-r border-[#141414]/5 flex flex-col bg-white/50">
        <div className="p-6 border-b border-[#141414]/5">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 opacity-40" />
            Active Sessions
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.map(session => (
            <button
              key={session.userId}
              onClick={() => setActiveSession(session.userId)}
              className={`w-full p-4 text-left rounded-2xl transition-all flex items-center gap-4 group ${
                activeSession === session.userId 
                  ? 'bg-[#141414] text-white shadow-lg' 
                  : 'hover:bg-[#141414]/5'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                activeSession === session.userId ? 'bg-white/10' : 'bg-[#141414]/5'
              }`}>
                <UserIcon className={`w-6 h-6 ${activeSession === session.userId ? 'text-white' : 'text-[#141414] opacity-40'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm truncate">
                    {session.userId.startsWith('anon_') ? 'Anonymous User' : session.userId}
                  </span>
                  {session.unreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {session.unreadCount}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate ${activeSession === session.userId ? 'opacity-60' : 'opacity-40'}`}>
                  {session.lastMessage}
                </p>
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="p-12 text-center opacity-30 italic text-sm">
              No active support requests
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white/30">
        {activeSession ? (
          <>
            <div className="p-6 border-b border-[#141414]/5 bg-white/80 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#141414]/5 rounded-2xl flex items-center justify-center">
                  <UserIcon className="w-6 h-6 opacity-40" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    {activeSession.startsWith('anon_') ? 'Anonymous User' : activeSession}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs opacity-40 font-bold uppercase tracking-widest">Active Support Session</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setActiveSession(null)}
                className="p-3 hover:bg-[#141414]/5 rounded-xl transition-colors lg:hidden"
              >
                <X className="w-5 h-5 opacity-40" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-[1.5rem] text-sm shadow-sm ${
                      msg.sender === 'admin' 
                        ? 'bg-[#141414] text-white rounded-tr-none' 
                        : msg.sender === 'ai'
                          ? 'bg-blue-50 text-blue-900 border border-blue-100 rounded-tl-none'
                          : 'bg-white border border-[#141414]/5 rounded-tl-none'
                    }`}>
                      {msg.sender === 'ai' && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold mb-2 opacity-50 uppercase tracking-widest">
                          <div className="w-1 h-1 bg-blue-500 rounded-full" />
                          AI Assistant
                        </div>
                      )}
                      {msg.image_url && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-white/20">
                          <img src={msg.image_url} alt="Uploaded" className="max-w-full" />
                        </div>
                      )}
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest mt-2 px-2">
                      {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {image && (
              <div className="px-8 py-4 bg-white/80 backdrop-blur-md border-t border-[#141414]/5">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#141414]/5 shadow-lg">
                  <img src={image} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute top-1 right-1 bg-[#141414] text-white p-1.5 rounded-xl hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 bg-white/80 backdrop-blur-md border-t border-[#141414]/5">
              <form onSubmit={handleSend} className="flex items-center gap-3 bg-[#F5F5F0] p-2 rounded-[2rem] border border-[#141414]/5">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-[#141414] opacity-40 hover:opacity-100 hover:bg-white rounded-2xl transition-all"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                <input
                  type="text"
                  placeholder="Type your response..."
                  className="flex-1 px-4 py-3 bg-transparent outline-none text-sm font-medium"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() && !image}
                  className="p-4 bg-[#141414] text-white rounded-2xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 bg-[#141414]/5 rounded-[2.5rem] flex items-center justify-center mb-6">
              <MessageCircle className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-xl font-bold mb-2">Support Dashboard</h3>
            <p className="text-sm opacity-40 max-w-xs mx-auto">
              Select an active session from the sidebar to start responding to user queries.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
