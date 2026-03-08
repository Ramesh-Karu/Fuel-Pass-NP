import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Image as ImageIcon, User as UserIcon, Bot, Shield, AlertCircle, Plus, Languages } from 'lucide-react';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import { useLanguage } from '../contexts/LanguageContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface ChatMessage {
  id: string;
  user_id: string;
  sender: 'user' | 'ai' | 'admin';
  text: string;
  image_url?: string;
  timestamp: any;
  status?: 'unread' | 'read';
}

export function Chatbot({ userId }: { userId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { language, setLanguage } = useLanguage();
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatWithAdmin, setChatWithAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTranslatedMessages({});
  }, [language]);

  const translateText = async (text: string, targetLanguage: 'en' | 'si' | 'ta') => {
    if (targetLanguage === 'en') return text;
    
    const targetLangName = targetLanguage === 'si' ? 'Sinhala' : 'Tamil';
    const prompt = `Translate the following text to ${targetLangName}: "${text}"`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || text;
  };

  useEffect(() => {
    messages.forEach(async (msg) => {
      if (language !== 'en' && !translatedMessages[msg.id]) {
        const translated = await translateText(msg.text, language);
        setTranslatedMessages(prev => ({ ...prev, [msg.id]: translated }));
      }
    });
  }, [messages, language]);


  const activeUserId = userId || localStorage.getItem('anonymous_chat_id') || `anon_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (!userId && !localStorage.getItem('anonymous_chat_id')) {
      localStorage.setItem('anonymous_chat_id', activeUserId);
    }
  }, [userId, activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    const q = query(
      collection(db, 'chat_messages'),
      where('user_id', '==', activeUserId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [activeUserId]);

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
    if (!input.trim() && !image && !loading) return;

    const currentImage = image;
    setInput('');
    setImage(null);
    setLoading(true);

    try {
      // Save user message
      const textToSave = input.trim();
      const textToPrompt = (language !== 'en') ? await translateText(textToSave, 'en') : textToSave;

      await addDoc(collection(db, 'chat_messages'), {
        user_id: activeUserId,
        sender: 'user',
        text: textToSave,
        image_url: currentImage || null,
        timestamp: serverTimestamp(),
        status: 'unread'
      });

      if (!chatWithAdmin) {
        // Generate AI response
        const prompt = `You are a helpful assistant for the Northern Province Fuel Pass system. 
        The system allows users to register vehicles, get a QR code, and pump fuel within their weekly limits.
        Users can check their quota and history.
        Answer the following user query concisely and helpfully: ${textToPrompt}`;

        const parts: any[] = [{ text: prompt }];
        if (currentImage) {
          const base64Data = currentImage.split(',')[1];
          const mimeType = currentImage.split(';')[0].split(':')[1];
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts },
        });

        const aiText = response.text || "I'm sorry, I couldn't process that.";

        // Save AI message
        await addDoc(collection(db, 'chat_messages'), {
          user_id: activeUserId,
          sender: 'ai',
          text: aiText,
          timestamp: serverTimestamp(),
          status: 'read'
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50 ${isOpen ? 'hidden' : ''}`}>
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                onClick={() => {
                  const event = new CustomEvent('open-complaint-modal');
                  window.dispatchEvent(event);
                  setIsMenuOpen(false);
                }}
                className="w-12 h-12 bg-red-600/90 backdrop-blur-md text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                title="Register Complaint"
              >
                <AlertCircle className="w-5 h-5" />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ delay: 0.05 }}
                onClick={() => {
                  setIsOpen(true);
                  setIsMenuOpen(false);
                }}
                className="w-12 h-12 bg-[#141414]/80 backdrop-blur-md text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                title="AI Assistant"
              >
                <MessageCircle className="w-5 h-5" />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ delay: 0.1 }}
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className={`w-12 h-12 backdrop-blur-md text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform ${isLanguageMenuOpen ? 'bg-emerald-600' : 'bg-[#141414]/80'}`}
                title="Select Language"
              >
                <Languages className="w-5 h-5" />
              </motion.button>
              <AnimatePresence>
                {isLanguageMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute bottom-40 right-0 mb-2 w-32 bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden z-50"
                  >
                    <div className="p-2 space-y-1">
                      {['en', 'si', 'ta'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setLanguage(lang as 'en' | 'si' | 'ta');
                            setIsLanguageMenuOpen(false);
                            setIsMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 rounded-xl text-sm ${language === lang ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50'}`}
                        >
                          {lang === 'en' ? 'English' : lang === 'si' ? 'Sinhala' : 'Tamil'}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-14 h-14 backdrop-blur-md text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all ${isMenuOpen ? 'bg-gray-800 rotate-45' : 'bg-[#141414]'}`}
          title="Menu"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[350px] h-[500px] bg-white rounded-3xl shadow-2xl border border-[#141414]/10 flex flex-col overflow-hidden z-50"
          >
            <div className="p-4 bg-[#141414] text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  {chatWithAdmin ? <Shield className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{chatWithAdmin ? 'Live Support' : 'AI Assistant'}</h3>
                  <p className="text-[10px] opacity-70">{chatWithAdmin ? 'Chatting with Admin' : 'Ask me anything'}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F0]/30">
              {messages.length === 0 && (
                <div className="text-center opacity-50 text-sm mt-10">
                  <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Hi! How can I help you today?</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.sender === 'user' 
                      ? 'bg-[#141414] text-white rounded-br-sm' 
                      : msg.sender === 'admin'
                        ? 'bg-blue-50 text-blue-900 border border-blue-100 rounded-bl-sm'
                        : 'bg-white border border-[#141414]/10 rounded-bl-sm'
                  }`}>
                    {msg.image_url && (
                      <img src={msg.image_url} alt="Uploaded" className="max-w-full rounded-lg mb-2" />
                    )}
                    {language !== 'en' && translatedMessages[msg.id] ? translatedMessages[msg.id] : msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl text-sm bg-white border border-[#141414]/10 rounded-bl-sm flex gap-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {!chatWithAdmin && (
              <div className="px-4 py-2 bg-[#F5F5F0]/50 border-t border-[#141414]/5 text-center">
                <button 
                  onClick={() => setChatWithAdmin(true)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Not satisfied? Chat with an Admin
                </button>
              </div>
            )}

            {image && (
              <div className="px-4 py-2 bg-gray-50 border-t border-[#141414]/10">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                  <img src={image} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute top-0 right-0 bg-black/50 text-white p-1 rounded-bl-lg hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="p-4 bg-white border-t border-[#141414]/10 flex items-center gap-2">
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
                className="p-2 text-gray-400 hover:text-[#141414] transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-[#F5F5F0] rounded-full outline-none text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button 
                type="submit"
                disabled={(!input.trim() && !image) || loading}
                className="p-2 bg-[#141414] text-white rounded-full disabled:opacity-50 hover:bg-opacity-90 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
