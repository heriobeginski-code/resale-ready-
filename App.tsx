/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Copy, 
  Check, 
  Upload, 
  Camera, 
  Package, 
  DollarSign, 
  Tag, 
  Info, 
  X, 
  Loader2,
  AlertCircle,
  ChevronRight,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  estimated_value: number;
  currency: string;
  condition_notes: string;
  suggested_description: string;
  thumbnail: string; // base64
  createdAt: number;
}

interface AIResponse {
  item_name: string;
  category: string;
  estimated_value: number;
  currency: string;
  condition_notes: string;
  suggested_description: string;
}

// --- Constants ---

const STORAGE_KEY = 'resale_ready_inventory';

// --- Components ---

export default function App() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewItem, setReviewItem] = useState<(AIResponse & { thumbnail: string }) | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setInventory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse inventory", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  }, [inventory]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast("Please upload an image file", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const aiData = await processImageWithGemini(base64);
      if (aiData) {
        setReviewItem({ ...aiData, thumbnail: base64 });
      }
    } catch (error) {
      console.error(error);
      addToast("Failed to process image. Try again.", "error");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const processImageWithGemini = async (base64Image: string): Promise<AIResponse | null> => {
    try {
      // The API key is injected by the environment
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Identify this item for resale. Provide the name, category, estimated market value in USD, condition notes based on the image, and a catchy sales description. Return ONLY JSON." },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image.split(',')[1]
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              item_name: { type: Type.STRING },
              category: { type: Type.STRING },
              estimated_value: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              condition_notes: { type: Type.STRING },
              suggested_description: { type: Type.STRING }
            },
            required: ["item_name", "category", "estimated_value", "currency", "condition_notes", "suggested_description"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      return JSON.parse(text) as AIResponse;
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  };

  const approveItem = () => {
    if (!reviewItem) return;
    const newItem: InventoryItem = {
      ...reviewItem,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now()
    };
    setInventory(prev => [newItem, ...prev]);
    setReviewItem(null);
    addToast("Item added to inventory!");
  };

  const deleteItem = (id: string) => {
    setInventory(prev => prev.filter(item => item.id !== id));
    addToast("Item deleted", "success");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Description copied!");
  };

  const filteredInventory = inventory.filter(item => 
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-bottom border-stone-200 px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl text-white">
              <Package size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ResaleReady</h1>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-stone-900 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 hover:bg-stone-800 transition-all active:scale-95 shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Item</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="image/*"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        {/* Search & Stats */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Total Items</span>
              <span className="text-2xl font-bold">{inventory.length}</span>
            </div>
            <div className="flex-1 md:flex-none bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Est. Value</span>
              <span className="text-2xl font-bold text-emerald-600">
                ${inventory.reduce((acc, item) => acc + item.estimated_value, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Inventory List */}
        {inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-stone-200">
            <div className="bg-stone-100 p-6 rounded-full mb-4">
              <Camera size={48} className="text-stone-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Your inventory is empty</h2>
            <p className="text-stone-500 mb-6 text-center max-w-xs">Upload a photo of an item and let AI identify, price, and describe it for you.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-600 text-white px-8 py-3 rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              Start Scanning
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-bottom border-stone-200">
                    <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Item</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Value</th>
                    <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredInventory.map((item) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={item.id} 
                      className="group hover:bg-stone-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <img 
                            src={item.thumbnail} 
                            alt={item.item_name} 
                            className="w-12 h-12 rounded-xl object-cover border border-stone-200 shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-stone-900">{item.item_name}</div>
                            <div className="text-xs text-stone-500 line-clamp-1 max-w-[200px]">{item.condition_notes}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                        ${item.estimated_value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => copyToClipboard(item.suggested_description)}
                            className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Copy Description"
                          >
                            <Copy size={18} />
                          </button>
                          <button 
                            onClick={() => setEditingItem(item)}
                            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => deleteItem(item.id)}
                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-xs w-full">
              <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
              <h3 className="text-lg font-bold mb-2">Analyzing Item...</h3>
              <p className="text-stone-500 text-center text-sm">Our AI is identifying your item and calculating its market value.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Side Panel / Overlay */}
      <AnimatePresence>
        {reviewItem && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-bottom border-stone-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Review AI Analysis</h2>
                <button onClick={() => setReviewItem(null)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="relative group">
                  <img 
                    src={reviewItem.thumbnail} 
                    alt="Review" 
                    className="w-full aspect-video object-cover rounded-2xl border border-stone-200"
                  />
                  <div className="absolute top-4 right-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    AI Identified
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Item Name</label>
                    <input 
                      type="text" 
                      value={reviewItem.item_name}
                      onChange={(e) => setReviewItem({...reviewItem, item_name: e.target.value})}
                      className="w-full font-bold text-lg focus:outline-none border-b border-transparent focus:border-emerald-500 pb-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Est. Value</label>
                    <div className="flex items-center gap-1 text-emerald-600 font-mono font-bold text-lg">
                      <span>$</span>
                      <input 
                        type="number" 
                        value={reviewItem.estimated_value}
                        onChange={(e) => setReviewItem({...reviewItem, estimated_value: parseFloat(e.target.value) || 0})}
                        className="w-full focus:outline-none border-b border-transparent focus:border-emerald-500 pb-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Category</label>
                  <input 
                    type="text" 
                    value={reviewItem.category}
                    onChange={(e) => setReviewItem({...reviewItem, category: e.target.value})}
                    className="w-full text-stone-600 focus:outline-none border-b border-transparent focus:border-emerald-500 pb-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Condition Notes</label>
                  <textarea 
                    value={reviewItem.condition_notes}
                    onChange={(e) => setReviewItem({...reviewItem, condition_notes: e.target.value})}
                    className="w-full text-sm text-stone-600 focus:outline-none border-b border-transparent focus:border-emerald-500 pb-1 resize-none"
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sales Description</label>
                  <textarea 
                    value={reviewItem.suggested_description}
                    onChange={(e) => setReviewItem({...reviewItem, suggested_description: e.target.value})}
                    className="w-full text-sm text-stone-600 bg-stone-50 p-3 rounded-xl focus:outline-none border border-stone-200 focus:border-emerald-500 transition-all"
                    rows={4}
                  />
                </div>
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
                <button 
                  onClick={() => setReviewItem(null)}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold text-stone-600 hover:bg-stone-200 transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={approveItem}
                  className="flex-[2] px-6 py-3 rounded-2xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Approve & Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-bottom border-stone-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Item</h2>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Name</label>
                  <input 
                    type="text" 
                    value={editingItem.item_name}
                    onChange={(e) => setEditingItem({...editingItem, item_name: e.target.value})}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Value ($)</label>
                  <input 
                    type="number" 
                    value={editingItem.estimated_value}
                    onChange={(e) => setEditingItem({...editingItem, estimated_value: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Description</label>
                  <textarea 
                    value={editingItem.suggested_description}
                    onChange={(e) => setEditingItem({...editingItem, suggested_description: e.target.value})}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    rows={4}
                  />
                </div>
              </div>
              <div className="p-6 bg-stone-50 flex gap-3">
                <button 
                  onClick={() => {
                    setInventory(prev => prev.map(item => item.id === editingItem.id ? editingItem : item));
                    setEditingItem(null);
                    addToast("Item updated!");
                  }}
                  className="w-full py-3 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div 
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3 min-w-[200px] ${
                toast.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {toast.type === 'success' ? <Check size={18} className="text-emerald-400" /> : <AlertCircle size={18} />}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
