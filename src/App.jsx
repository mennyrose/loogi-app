import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Package, ShoppingCart, Truck, CheckCircle, AlertCircle, 
  RotateCcw, User, LayoutDashboard, Database, ClipboardList, Plus, 
  LogOut, Menu, X, ChevronDown, ArrowUpRight, ShoppingBag, Users,
  ShieldCheck, Settings, Trash2, Edit2, UserPlus, Info, FileText,
  MessageSquare, Download, BarChart2, Briefcase, History, Upload, Image as ImageIcon, Save,
  ArrowRight, CreditCard, PenTool, Check, ChevronLeft, ExternalLink, RefreshCw, Send
} from 'lucide-react';

// --- FIREBASE & SERVICES ---
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  seedInitialData, 
  subscribeToCollection, 
  subscribeToInventory, 
  getUserByEmail,
  updateInventoryInFirestore,
  addRequestToFirestore,
  updateRequestStatusInFirestore,
  updateRequestInFirestore,
  addUserToFirestore,
  addTransaction,
  addItemToCatalog,
  updateBattalionInventory
} from './services/dataService';
import { processQuery, exportToExcel } from './services/aiService';

// --- NEW COMPONENT: SerialPicker ---
const SerialPicker = ({ available, selected, onSelect, onClose }) => (
  <div className="fixed inset-0 bg-idf-dark/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
      <h3 className="text-xl font-black mb-6">בחירת מספרי צ' (סריאליים)</h3>
      <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
        {available.map(sn => (
          <button 
            key={sn} 
            onClick={() => onSelect(sn)}
            className={`p-3 rounded-xl border-2 font-black text-xs transition-all ${selected.includes(sn) ? 'bg-idf-primary text-white border-idf-primary' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
          >
            {sn}
          </button>
        ))}
        {available.length === 0 && <div className="col-span-3 text-center p-10 text-slate-300 italic">אין מספרי צ' במלאי</div>}
      </div>
      <button onClick={onClose} className="btn-primary w-full mt-8 py-4 rounded-2xl">סיום וסגירה</button>
    </div>
  </div>
);

// --- CONSTANTS ---
const ROLE_LABELS = { LOGI_OFFICER: 'קל"ג', LOGISTICS_TEAM: 'לוגיסטיקה', COMPANY_SGT: 'נציג פלוגה', ADMIN: 'אדמין' };
const COMPANIES = ['אלפא', 'בזלת', 'גולן', 'דקל', 'מפקדה'];
const ACTION_TYPES = [
  { id: 'ISSUE_TO_CO', label: 'ניפוק לפלוגה' },
  { id: 'RETURN_FROM_CO', label: 'החזרה מפלוגה' },
  { id: 'RECEIVE_FROM_BDE', label: 'קבלה מהחטיבה' },
  { id: 'RETURN_TO_BDE', label: 'החזרה לחטיבה' },
  { id: 'SCRAP_LAUNDRY', label: 'העברה לבלאי/כביסה' },
];

const INITIAL_CATALOG = [
  { internal_id: 'i1', sku: '600100', name: 'וסט לוחם "דורון"', category: 'צל"ם אישי', type: 'קבוע', tracking: 'סריאלי' },
  { internal_id: 'i2', sku: '600101', name: 'קסדה טקטית', category: 'צל"ם אישי', type: 'קבוע', tracking: 'סריאלי' },
  { internal_id: 'i3', sku: '200400', name: 'מדי ב\' ריפסטופ', category: 'טקסטיל', type: 'מתכלה', tracking: 'כמותי' },
];
const INITIAL_INVENTORY = {
  battalion: [
    { item_id: 'i1', qty: 45, min: 10, serials: ['צ1001', 'צ1002', 'צ1003', 'צ1004', 'צ1005'] }, 
    { item_id: 'i2', qty: 30, min: 5, serials: ['ק501', 'ק502', 'ק503'] }
  ],
  companies: { 'אלפא': [{ item_id: 'i1', qty: 120, serials: [] }], 'בזלת': [], 'גולן': [], 'דקל': [], 'מפקדה': [] }
};
const INITIAL_USERS = [
  { id: 'u0', email: 'mennyr@gmail.com', full_name: 'מני', role: 'ADMIN', company: 'מנהלה' },
  { id: 'u1', email: 'qalag@idf.il', full_name: 'יוסי כהן', role: 'LOGI_OFFICER', company: 'מפקדה' },
];

// --- LOGO COMPONENT ---
const Logo = () => (
  <div className="flex items-center gap-3">
    <img 
      src="/logo_official.png" 
      alt="L∞Giz Logo" 
      className="h-12 w-auto object-contain"
    />
  </div>
);

const Badge = ({ children, variant = 'neutral' }) => {
  const styles = {
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-sky-50 text-sky-700 border-sky-100',
    gold: 'bg-amber-50 text-amber-600 border-amber-200'
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${styles[variant]}`}>
      {children}
    </span>
  );
};

// --- ISSUING MODULE ---
const IssuingModule = ({ catalog, inventory, user, templates }) => {
  const [step, setStep] = useState('ACTION');
  const [action, setAction] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [targetCompany, setTargetCompany] = useState('אלפא');
  const [receiverDetails, setReceiverDetails] = useState({ id: '', name: '', unit: '' });
  const [signature, setSignature] = useState(false);
  const [serialPickerItem, setSerialPickerItem] = useState(null);

  const categories = useMemo(() => [...new Set(catalog.map(i => i.category))], [catalog]);
  const filteredItems = useMemo(() => {
    return catalog
      .filter(i => (!selectedCategory || i.category === selectedCategory) && (i.name.includes(search) || i.sku.includes(search)))
      .sort((a,b) => a.name.localeCompare(b.name, 'he'));
  }, [catalog, selectedCategory, search]);

  const handleAddUser = async () => {
    if (!newData.email || !newData.full_name) return alert("נא למלא את כל השדות");
    await addUserToFirestore({ ...newData, role: newData.role || 'COMPANY_SGT', company: newData.company || 'אלפא' });
    setShowModal(null);
    setNewData({});
  };

  const handleAddItem = async () => {
    if (!newData.name || !newData.internal_id) return alert("נא למלא את כל השדות");
    await addItemToCatalog({ 
      name: newData.name, 
      internal_id: newData.internal_id.toString(), 
      category: newData.category || 'כללי',
      tracking: newData.tracking || 'כמותי'
    });
    await updateBattalionInventory({ 
      battalion: [...inventory.battalion, { item_id: newData.internal_id.toString(), qty: parseInt(newData.qty || 0) }],
      companies: inventory.companies
    });
    setShowModal(null);
    setNewData({});
  };

  const addToCart = (item, qty, serials = []) => {
    const existing = cart.find(c => c.internal_id === item.internal_id);
    if (existing) {
      setCart(cart.map(c => c.internal_id === item.internal_id ? { ...c, qty: (c.qty || 0) + qty, serials: [...(c.serials || []), ...serials] } : c));
    } else {
      setCart([...cart, { ...item, qty, serials }]);
    }
  };

  const handleApplyTemplate = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    template.items.forEach(ti => {
      const item = catalog.find(i => i.internal_id === ti.item_id);
      if (item) addToCart(item, ti.qty);
    });
  };

  const handleConfirm = async () => {
    let newBattalion = [...inventory.battalion];
    let newCompanies = { ...inventory.companies };

    cart.forEach(item => {
      const bIdx = newBattalion.findIndex(i => i.item_id === item.internal_id);
      if (action === 'ISSUE_TO_CO') {
        if (bIdx > -1) {
          newBattalion[bIdx].qty -= item.qty;
          if (item.serials) {
            newBattalion[bIdx].serials = (newBattalion[bIdx].serials || []).filter(s => !item.serials.includes(s));
          }
        }
        if (!newCompanies[targetCompany]) newCompanies[targetCompany] = [];
        const cIdx = newCompanies[targetCompany].findIndex(i => i.item_id === item.internal_id);
        if (cIdx > -1) {
          newCompanies[targetCompany][cIdx].qty += item.qty;
          if (item.serials) {
            newCompanies[targetCompany][cIdx].serials = [...(newCompanies[targetCompany][cIdx].serials || []), ...item.serials];
          }
        } else {
          newCompanies[targetCompany].push({ item_id: item.internal_id, qty: item.qty, serials: item.serials || [] });
        }
      } else if (action === 'RETURN_FROM_CO') {
        if (bIdx > -1) {
          newBattalion[bIdx].qty += item.qty;
          if (item.serials) {
            newBattalion[bIdx].serials = [...(newBattalion[bIdx].serials || []), ...item.serials];
          }
        }
        const cIdx = newCompanies[targetCompany].findIndex(i => i.item_id === item.internal_id);
        if (cIdx > -1) {
          newCompanies[targetCompany][cIdx].qty -= item.qty;
          if (item.serials) {
            newCompanies[targetCompany][cIdx].serials = (newCompanies[targetCompany][cIdx].serials || []).filter(s => !item.serials.includes(s));
          }
        }
      }
    });

    await updateInventoryInFirestore({ battalion: newBattalion, companies: newCompanies });
    
    // Create Audit Transaction
    await addTransaction({
      type: action,
      company: targetCompany,
      initiated_by: { email: user.email, name: user.full_name },
      receiver: receiverDetails,
      items: cart.map(i => ({ item_id: i.internal_id, name: i.name, qty: i.qty, serials: i.serials || [] })),
      signature_base64: signature // In a real app, this would be the actual image data
    });

    setStep('RECEIPT');
  };

  if (step === 'ACTION') return (
    <div className="max-w-xl mx-auto space-y-4 animate-slide-up bg-white p-8 rounded-3xl border shadow-sm">
      <h3 className="text-xl font-black mb-8 border-b pb-4 text-idf-dark">בחירת סוג ניפוק / פעולה</h3>
      <div className="grid grid-cols-1 gap-3">
        {ACTION_TYPES.map(a => (
          <button key={a.id} onClick={() => { setAction(a.id); setStep('SELECT'); }} className="flex justify-between items-center p-5 bg-slate-50 hover:bg-idf-primary hover:text-white rounded-2xl transition-all group border border-slate-100">
            <span className="font-black text-sm">{a.label}</span>
            <ChevronLeft size={18} className="text-slate-300 group-hover:text-white" />
          </button>
        ))}
      </div>
    </div>
  );

  if (step === 'SELECT') return (
    <div className="space-y-6 animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setStep('ACTION')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowRight /></button>
          <div>
            <h3 className="font-black text-lg text-idf-primary leading-tight">{ACTION_TYPES.find(a => a.id === action)?.label}</h3>
            <p className="text-[10px] font-bold text-slate-400">בחר פריטים או טען ערכה</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {(action === 'ISSUE_TO_CO' || action === 'RETURN_FROM_CO') && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border">
              <span className="text-[10px] font-black text-slate-400 pr-2">עבור:</span>
              <select value={targetCompany} onChange={e => setTargetCompany(e.target.value)} className="bg-transparent font-black text-sm outline-none">
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border">
            <Briefcase size={14} className="text-idf-primary ml-1" />
            <select onChange={e => handleApplyTemplate(e.target.value)} className="bg-transparent font-black text-sm outline-none" defaultValue="">
              <option value="" disabled>טען ערכת זיווד...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <div className="p-4 bg-white rounded-2xl border shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">סינון לפי קטגוריה</h4>
            <div className="flex flex-col gap-1">
              <button onClick={() => setSelectedCategory(null)} className={`text-right p-3 rounded-xl font-black text-xs transition-all ${!selectedCategory ? 'bg-idf-primary text-white shadow-lg shadow-idf-primary/20' : 'hover:bg-slate-50 text-slate-500'}`}>הכל</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`text-right p-3 rounded-xl font-black text-xs transition-all ${selectedCategory === cat ? 'bg-idf-primary text-white shadow-lg shadow-idf-primary/20' : 'hover:bg-slate-50 text-slate-500'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-3 space-y-4">
          <div className="relative group">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-idf-primary transition-colors" size={20} />
            <input className="input-clean pr-14 bg-white text-sm shadow-sm" placeholder='חיפוש חופשי (לפי שם או מק"ט)...' value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => {
              const isSerial = item.tracking === 'סריאלי';
              const stockItem = inventory.battalion.find(i => i.item_id === item.internal_id);
              const availableSerials = stockItem?.serials || [];
              
              return (
                <div key={item.internal_id} className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="flex-1 mb-4">
                    <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-black text-slate-300 tracking-tighter uppercase">{item.sku}</span><Badge variant="gold">{item.category}</Badge></div>
                    <h5 className="font-black text-slate-800 text-sm">{item.name}</h5>
                    {isSerial && <p className="text-[8px] font-bold text-idf-primary mt-1 flex items-center gap-1"><ShieldCheck size={10}/> פריט סריאלי</p>}
                  </div>
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                    <input type="number" defaultValue={1} min={1} id={`qty-${item.internal_id}`} className="flex-1 p-2 bg-slate-50 border rounded-xl text-center font-black outline-none focus:ring-2 focus:ring-idf-primary/20" />
                    <button onClick={() => { 
                      const q = parseInt(document.getElementById(`qty-${item.internal_id}`).value);
                      if (isSerial) {
                        setSerialPickerItem({ ...item, requestedQty: q, available: availableSerials });
                      } else {
                        addToCart(item, q);
                      }
                    }} className="bg-idf-dark p-2.5 rounded-xl text-white hover:bg-idf-primary transition-all"><Plus size={20} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {cart.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-idf-dark text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-8 animate-slide-up z-[100]">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-idf-primary rounded-2xl flex items-center justify-center font-black text-lg">{cart.length}</div><span className="font-black text-sm">פריטים בעגלה</span></div>
          <button onClick={() => setStep('CHECKOUT')} className="bg-idf-primary px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg">סיכום ואישור</button>
        </div>
      )}
      {serialPickerItem && (
        <SerialPicker 
          available={serialPickerItem.available}
          selected={[]} 
          onSelect={(sn) => {
            addToCart(serialPickerItem, 1, [sn]);
          }}
          onClose={() => setSerialPickerItem(null)}
        />
      )}
    </div>
  );

  if (step === 'CHECKOUT') return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-32">
      <div className="bg-white rounded-[2.5rem] border shadow-2xl overflow-hidden">
        <div className="p-8 bg-slate-50 border-b flex justify-between items-center"><h3 className="text-2xl font-black">סיכום פעולת ניפוק</h3><Badge variant="gold">{ACTION_TYPES.find(a => a.id === action)?.label}</Badge></div>
        <div className="p-8 grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-6">
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.internal_id} className="flex justify-between items-center p-5 bg-white border rounded-2xl shadow-sm italic transition-all hover:border-idf-primary">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{item.name}</p>
                    {item.serials?.length > 0 && (
                      <p className="text-[9px] text-idf-primary font-bold mt-1">צ': {item.serials.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-6"><span className="font-black text-lg text-idf-primary">x {item.qty}</span><button onClick={() => setCart(cart.filter(c => c.internal_id !== item.internal_id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={18} /></button></div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-8 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
             <div className="space-y-4">
                <input className="input-clean pr-12 text-sm font-bold bg-white" placeholder="מספר אישי (7 ספרות)" value={receiverDetails.id} onChange={e => {
                  setReceiverDetails({ ...receiverDetails, id: e.target.value });
                  if (e.target.value.length === 7) setReceiverDetails({ id: e.target.value, name: "ישראל ישראלי", unit: "סנכרון Firebase..." });
                }} />
                {receiverDetails.name && <div className="p-5 bg-emerald-50 rounded-2xl border animate-fade-in"><p className="font-black text-emerald-800 text-sm">{receiverDetails.name}</p></div>}
             </div>
             <div className="h-48 bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-300 cursor-pointer" onClick={() => setSignature(true)}>
               {signature ? <div className="font-cursive text-4xl text-slate-800">חתימה דיגיטלית</div> : <PenTool size={32} />}
             </div>
             <button onClick={handleConfirm} disabled={!signature || !receiverDetails.name} className="w-full btn-primary justify-center py-5 text-sm disabled:opacity-30">אשר ניפוק והפק קבלה</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (step === 'RECEIPT') return (
    <div className="max-w-md mx-auto space-y-6 animate-slide-up bg-white p-12 rounded-[3.5rem] border-8 shadow-2xl text-center relative overflow-hidden">
      <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/30 rotate-3"><Check size={50} strokeWidth={3} /></div>
      <h3 className="text-4xl font-black mb-2 text-idf-dark">בוצע בהצלחה!</h3>
      <button onClick={() => { setStep('ACTION'); setCart([]); setSignature(false); }} className="w-full btn-primary justify-center py-6 rounded-3xl text-lg shadow-xl shadow-idf-primary/30">ניפוק חדש</button>
    </div>
  );
};

// --- NEW COMPONENT: LogiBot ---
const LogiBot = ({ catalog, inventory, requests, transactions, onClose, apiKey }) => {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'שלום! אני LogiBot, העוזר הלוגיסטי החכם שלך. איך אוכל לעזור היום?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef();
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const onSend = async (txt) => {
    if (!txt.trim()) return;
    const userMsg = { role: 'user', text: txt };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    
    // Process AI
    const resp = await processQuery(txt, { catalog, inventory, requests, transactions }, apiKey);
    setMessages(prev => [...prev, { role: 'bot', ...resp }]);
    setIsTyping(false);
  };

  return (
    <div className="fixed bottom-24 left-10 w-[400px] h-[600px] bg-white rounded-[2.5rem] border shadow-2xl flex flex-col overflow-hidden animate-scale-in z-[500] border-idf-primary/20">
      <div className="p-5 bg-idf-dark text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-idf-primary rounded-2xl flex items-center justify-center animate-pulse"><MessageSquare size={22} /></div>
          <div><h3 className="font-black text-sm">LogiBot AI</h3><p className="text-[8px] opacity-60 uppercase tracking-widest">v3.5 Gemini Enhanced</p></div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-[1.5rem] shadow-sm text-xs font-bold leading-relaxed ${m.role === 'user' ? 'bg-white border rounded-tr-none text-slate-700' : 'bg-idf-primary text-white rounded-tl-none'}`}>
              <p>{m.text}</p>
              {m.data && (
                <div className="mt-3 overflow-x-auto rounded-xl border bg-white/10 p-2 text-[9px]">
                  <table className="w-full text-right">
                    <thead><tr className="border-b border-white/20">
                      {Object.keys(m.data[0]).map(k => <th key={k} className="p-1 opacity-60">{k}</th>)}
                    </tr></thead>
                    <tbody>{m.data.map((row, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        {Object.values(row).map((v, idx2) => <td key={idx2} className="p-1">{v}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                  <button onClick={() => exportToExcel(m.data)} className="mt-2 flex items-center gap-1 text-[8px] bg-white/20 px-2 py-1 rounded-lg hover:bg-white/30 transition-all">
                    <Download size={10} /> ייצוא לאקסל
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && <div className="flex justify-end animate-pulse"><div className="bg-idf-primary/10 p-3 rounded-2xl text-[10px] font-black text-idf-primary">חושב...</div></div>}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white border-t space-y-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['מה חסר?', 'השוואת מלאי', 'מתי ייגמר המלאי?', 'עזרה'].map(q => (
              <button key={q} onClick={() => onSend(q)} className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-idf-primary hover:text-white rounded-lg text-[9px] font-black transition-all border border-slate-100 italic">
                {q}
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <input className="input-clean bg-slate-50 border h-12 text-xs" placeholder="שאל אותי משהו..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSend(input)} />
          <button onClick={() => onSend(input)} className="bg-idf-primary text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'
  
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState({ battalion: [], companies: {} });
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('requests');
  const [showModal, setShowModal] = useState(null); // 'user' | 'item' | 'import' | 'serial'
  const [activeSerialItem, setActiveSerialItem] = useState(null);
  const [newData, setNewData] = useState({});
  const [botOpen, setBotOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || 'AIzaSyBiVqKFHQ2DizDvYyh1boAO0tH6qM1SCLw');

  useEffect(() => {
    // Force Persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const loadingTimeout = setTimeout(() => setLoading(false), 10000);

    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // STEP 1: Set user immediately with basic info to UNBLOCK UI
        setUser({ 
          ...authUser, 
          role: 'COMPANY_SGT', 
          company: 'אלפא', 
          full_name: authUser.displayName || 'משתמש גוגל' 
        });
        setLoading(false);

        // STEP 2: Fetch metadata in background
        try {
          const userData = await getUserByEmail(authUser.email);
          if (userData) {
            setUser(prev => ({ ...prev, ...userData }));
            setDbStatus('online');
          } else {
            setDbStatus('online'); // Connection works, but user is new
          }
        } catch (err) {
          console.error("BG DB Error:", err);
          setDbStatus('offline');
        }
      } else {
        setUser(null);
        setLoading(false);
      }
      clearTimeout(loadingTimeout);
    });

    // Real-time subscribers with basic error handling
    const unsubCatalog = subscribeToCollection("catalog", (data) => {
      if (data && data.length > 0) setCatalog(data);
    });
    
    const unsubInventory = subscribeToInventory((data) => {
      if (data) setInventory(data);
    });

    const unsubRequests = subscribeToCollection("requests", setRequests);
    const unsubUsers = subscribeToCollection("users", setUsers);
    const unsubTx = subscribeToCollection("transactions", (data) => {
      setTransactions(data.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    const unsubTemplates = subscribeToCollection("templates", setTemplates);

    // Initial Seeding (wrapped in try-catch to prevent blocking)
    const runSeed = async () => {
      try {
        await seedInitialData({ catalog: INITIAL_CATALOG, inventory: INITIAL_INVENTORY, users: INITIAL_USERS });
      } catch (err) {
        console.error("Seeding failed (DB might not be initialized):", err);
      }
    };
    runSeed();

    return () => { 
      unsubAuth(); unsubCatalog(); unsubInventory(); unsubRequests(); unsubUsers(); unsubTx(); unsubTemplates();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        alert("התחברות בוטלה: החלון נסגר או נחסם על ידי הדפדפן. נסה שוב וודא שאינך חוסם חלונות קופצים.");
      } else {
        alert("שגיאת התחברות: " + error.message);
      }
    }
  };
  const handleLogout = () => signOut(auth);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-heebo" dir="rtl">
      <div className="animate-spin text-idf-primary"><RefreshCw size={48} /></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-heebo text-right" dir="rtl">
      <div className="bg-white max-w-sm w-full rounded-[3.5rem] shadow-2xl border-8 border-idf-primary/5 p-14 text-center animate-fade-in">
        <Logo />
        <p className="text-idf-primary text-[10px] font-black mt-6 mb-14 uppercase tracking-[0.5em] opacity-60">Battalion 6609 Logistics</p>
        <button onClick={handleLogin} className="w-full btn-primary justify-center py-6 rounded-2xl text-lg shadow-2xl shadow-idf-primary/30 flex items-center gap-4">
          <Database size={24} />
          התחברות עם Google
        </button>

        <p className="mt-8 text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-loose">
          המערכת מאובטחת ומחוברת בזמן אמת<br/>למסד הנתונים הגדודי ב-Firebase
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] font-heebo text-right overflow-x-hidden" dir="rtl">
      <header className="fixed top-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-2xl border-b z-[100] px-10 flex justify-between items-center shadow-sm">
        <Logo />
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-5 border-l-2 pr-2 pl-8 border-slate-50">
              <div className="text-right leading-tight">
                <span className="text-slate-300 font-black text-[9px] uppercase tracking-[0.2em]">{ROLE_LABELS[user.role]} {user.role === 'COMPANY_SGT' && user.company}</span>
                <div className="text-idf-dark font-black text-base">{user.full_name}</div>
              </div>
              <div className="w-14 h-14 bg-idf-primary rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-idf-primary/20">{user.full_name[0]}</div>
           </div>
           <button onClick={handleLogout} className="p-3 bg-slate-50 text-slate-300 hover:text-rose-500 rounded-2xl transition-all shadow-sm"><LogOut size={22} /></button>
        </div>
      </header>
      
      <main className="pt-36 px-4 md:px-10 max-w-7xl mx-auto pb-20">
        <div className="space-y-8 animate-fade-in">
          <div className="flex gap-6 border-b-2 border-slate-100 overflow-x-auto no-scrollbar">
            {[
              { id: 'requests', label: 'דרישות', icon: ShoppingCart, roles: ['ADMIN', 'LOGI_OFFICER', 'COMPANY_SGT', 'LOGISTICS_TEAM'] },
              { id: 'issuing', label: 'ניפוק פריטים', icon: Truck, roles: ['ADMIN', 'LOGI_OFFICER', 'LOGISTICS_TEAM'] },
              { id: 'inventory', label: 'מלאי גדודי', icon: LayoutDashboard, roles: ['ADMIN', 'LOGI_OFFICER', 'LOGISTICS_TEAM'] },
              { id: 'history', label: 'היסטוריית תנועות', icon: History, roles: ['ADMIN', 'LOGI_OFFICER'] },
              { id: 'mgmt', label: 'ניהול מערכת', icon: Settings, roles: ['ADMIN', 'LOGI_OFFICER'] },
            ].filter(t => t.roles.includes(user.role)).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-3 px-8 py-5 font-black text-xs transition-all border-b-4 -mb-[2px] ${activeTab === t.id ? 'text-idf-primary border-idf-primary' : 'text-slate-400 border-transparent hover:text-slate-700'}`}>
                <t.icon size={18} />{t.label}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'requests' && (
              <div className="space-y-6 animate-fade-in">
                {(user.role === 'ADMIN' || user.role === 'LOGI_OFFICER') ? (
                  <div className="grid grid-cols-1 gap-6">
                    {/* Command Center View */}
                    <div className="bg-white rounded-3xl border shadow-sm p-8">
                      <div className="flex justify-between items-center mb-8 border-b pb-4">
                        <div>
                          <h3 className="text-xl font-black text-idf-dark">מרכז שליטה לוגיסטי - ניהול הקצאות</h3>
                          <p className="text-xs text-slate-400">ניהול דרישות רוחבי ותעדוף פלוגות</p>
                        </div>
                        <Badge variant="info" className="px-4 py-2 text-xs">מצב תמיכת החלטות פעיל</Badge>
                      </div>

                      <div className="space-y-4">
                        {catalog.map(item => {
                          const itemRequests = requests.filter(r => r.item_id === item.internal_id && r.status !== 'ISSUED');
                          const stock = inventory.battalion.find(i => i.item_id === item.internal_id)?.qty || 0;
                          if (itemRequests.length === 0) return null;

                          return (
                            <div key={item.internal_id} className="border rounded-2xl overflow-hidden bg-slate-50/50">
                              <div className="p-4 bg-white flex justify-between items-center border-b">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-idf-primary font-black">
                                    {itemRequests.length}
                                  </div>
                                  <div>
                                    <h4 className="font-black text-base">{item.name}</h4>
                                    <p className="text-[10px] text-slate-400">סה"כ נדרש: {itemRequests.reduce((a,b) => a + b.qty, 0)} | <span className="text-idf-primary font-bold">במלאי: {stock}</span></p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={async () => {
                                      for (const req of itemRequests) {
                                        if (req.status === 'PENDING') {
                                          await updateRequestInFirestore(req.id, { status: 'ESCALATED_TO_BRIGADE' });
                                        }
                                      }
                                    }}
                                    className="text-[10px] font-black p-2 hover:bg-slate-50 rounded-lg text-slate-400">
                                    העבר לחטיבה
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      const lastModified = itemRequests.find(r => r.previousStatus);
                                      if (lastModified) {
                                        await updateRequestInFirestore(lastModified.id, { 
                                          status: lastModified.previousStatus, 
                                          approvedQty: 0, 
                                          previousStatus: null 
                                        });
                                      }
                                    }}
                                    className="text-[10px] font-black p-2 hover:bg-slate-50 rounded-lg text-slate-400 flex items-center gap-1">
                                    <History size={12}/> Undo
                                  </button>
                                </div>
                              </div>
                              
                              <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                                {['אלפא', 'בראבו', 'ג', 'מפקדה', 'מסייעת'].map(comp => {
                                  const req = itemRequests.find(r => r.company === comp);
                                  return (
                                    <div key={comp} className={`p-4 rounded-xl border ${req ? 'bg-white shadow-sm border-blue-100' : 'bg-slate-50/30 border-dashed opacity-60'}`}>
                                      <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">{comp}</div>
                                      <div className="flex justify-between items-end">
                                        <div className="text-[10px] font-bold">
                                          {req ? `ביקשו: ${req.qty}` : 'לא ביקשו'}
                                        </div>
                                        <input 
                                          type="number" 
                                          defaultValue={req?.approvedQty || 0}
                                          onChange={async (e) => {
                                            const val = parseInt(e.target.value);
                                            if (req) {
                                              await updateRequestInFirestore(req.id, { approvedQty: val, status: 'READY_FOR_PICKUP', previousStatus: req.status });
                                            } else {
                                              // Proactive allocation
                                              await addRequestToFirestore({
                                                item_id: item.internal_id,
                                                company: comp,
                                                qty: 0,
                                                approvedQty: val,
                                                status: 'READY_FOR_PICKUP',
                                                time: new Date().toLocaleTimeString()
                                              });
                                            }
                                          }}
                                          className="w-12 bg-slate-100 border-none rounded-lg text-center font-black text-idf-primary p-2 focus:ring-2 focus:ring-idf-primary/20"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-fade-in">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 text-slate-400 font-black border-b text-[10px] uppercase">
                        <tr><th className="p-6">מתי</th><th className="p-6">פלוגה</th><th className="p-6">פריט</th><th className="p-6 text-left">סטטוס</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {requests.filter(r => r.company === user.company).map(req => (
                          <tr key={req.id} className="hover:bg-slate-50">
                            <td className="p-6">{req.time || new Date().toLocaleDateString()}</td>
                            <td className="p-6">{req.company}</td>
                            <td className="p-6 font-black">{catalog.find(c => c.internal_id === req.item_id)?.name || 'פריט לא ידוע'}</td>
                            <td className="p-6 text-left"><Badge variant={req.status === 'PENDING' ? 'warning' : 'success'}>{req.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'issuing' && <IssuingModule catalog={catalog} inventory={inventory} user={user} templates={templates} />}
            {activeTab === 'history' && (
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-fade-in">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-black border-b text-[10px] uppercase">
                    <tr>
                      <th className="p-6">מתי</th>
                      <th className="p-6">סוג</th>
                      <th className="p-6">פלוגה</th>
                      <th className="p-6">מקבל (מספר אישי)</th>
                      <th className="p-6">פריטים</th>
                      <th className="p-6 text-left">חתימה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-6 text-slate-500">{new Date(tx.timestamp).toLocaleString('he-IL')}</td>
                        <td className="p-6"><Badge variant={tx.type.includes('ISSUE') ? 'info' : 'warning'}>{ACTION_TYPES.find(a => a.id === tx.type)?.label}</Badge></td>
                        <td className="p-6 font-black">{tx.company}</td>
                        <td className="p-6 text-[10px] font-bold">{tx.receiver.name} ({tx.receiver.id})</td>
                        <td className="p-6">
                          <div className="flex flex-col gap-1">
                            {tx.items.map((item, idx) => (
                              <span key={idx} className="text-xs">{item.name} <span className="text-idf-primary font-black">x{item.qty}</span></span>
                            ))}
                          </div>
                        </td>
                        <td className="p-6 text-left">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] font-black text-slate-300 italic border border-dashed">
                            Signed
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan="6" className="p-20 text-center text-slate-300 italic">טרם בוצעו תנועות במערכת</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'inventory' && (
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-black border-b text-[10px] uppercase">
                    <tr><th className="p-6">פריט</th><th className="p-6 text-center">כמות</th><th className="p-6 text-left">סטטוס</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventory.battalion.map(inv => {
                      const itemData = catalog.find(c => c.internal_id === inv.item_id);
                      return (
                        <tr key={inv.item_id} className="hover:bg-slate-50">
                          <td className="p-6">
                            <div className="font-black">{itemData?.name}</div>
                            {inv.serials?.length > 0 && (
                              <div className="text-[10px] text-idf-primary font-bold mt-1">צ': {inv.serials.join(', ')}</div>
                            )}
                          </td>
                          <td className="p-6 text-center font-black text-xl text-idf-primary">{inv.qty}</td>
                          <td className="p-6 text-left"><Badge variant="success">תקין</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'mgmt' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-4">
                    <h4 className="font-black">נתוני קטלוג גדודי</h4>
                    <div className="flex gap-2">
                      <button onClick={() => setShowModal('import')} className="p-2 text-slate-400 hover:text-idf-primary border rounded-xl"><Database size={14}/></button>
                      <button onClick={() => setShowModal('item')} className="btn-primary py-2 px-4 text-[10px] rounded-xl flex items-center gap-2">
                        <Plus size={14} /> הוסף פריט
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {catalog.map(item => (
                      <div key={item.internal_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group transition-all hover:bg-white hover:shadow-md">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono italic">{item.sku}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 text-slate-400 hover:text-idf-primary"><Edit2 size={14} /></button>
                          <button className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-4">
                    <h4 className="font-black">ניהול משתמשים</h4>
                    <button onClick={() => setShowModal('user')} className="btn-primary py-2 px-4 text-[10px] rounded-xl flex items-center gap-2">
                      <UserPlus size={14} /> הוסף משתמש
                    </button>
                  </div>
                  <div className="space-y-2">
                    {users.map(u => (
                      <div key={u.email} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group transition-all hover:bg-white hover:shadow-md">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{u.full_name}</span>
                          <span className="text-[10px] text-slate-400">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge>{ROLE_LABELS[u.role]}</Badge>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-slate-400 hover:text-idf-primary"><Edit2 size={14} /></button>
                            <button className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="input-clean text-xs pr-10 bg-slate-50" placeholder="מפתח Google Gemini API" type="password" value={geminiKey} onChange={e => {
                      setGeminiKey(e.target.value);
                      localStorage.setItem('gemini_api_key', e.target.value);
                    }} />
                    <button className="btn-primary py-3 rounded-xl text-[10px]" onClick={() => alert("המפתח נשמר מקומית בדפדפן")}>שמור מפתח API</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating LogiBot Toggle */}
      {(user.role === 'ADMIN' || user.role === 'LOGI_OFFICER') && !botOpen && (
        <button 
          onClick={() => setBotOpen(true)}
          className="fixed bottom-10 left-10 w-16 h-16 bg-idf-dark text-white rounded-2xl flex items-center justify-center shadow-2xl hover:bg-idf-primary transition-all z-[400] group"
        >
          <MessageSquare size={28} className="group-hover:scale-110 transition-transform" />
          <div className="absolute -top-2 -right-2 bg-idf-primary text-[8px] font-black px-2 py-1 rounded-full animate-bounce">AI</div>
        </button>
      )}

      {botOpen && (
        <LogiBot 
          catalog={catalog} 
          inventory={inventory} 
          requests={requests} 
          transactions={transactions} 
          apiKey={geminiKey}
          onClose={() => setBotOpen(false)} 
        />
      )}

      <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full border shadow-sm z-50">
        <div className={`w-2 h-2 rounded-full animate-pulse ${dbStatus === 'online' ? 'bg-emerald-500' : dbStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest tracking-[0.2em]">
          L∞Giz v2.7 {dbStatus === 'online' ? 'Cloud Connected' : 'Local Mode'}
        </span>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-idf-dark/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <h3 className="text-xl font-black mb-6">
              {showModal === 'user' ? 'הוספת משתמש חדש' : showModal === 'item' ? 'הוספת פריט לקטלוג' : 'ייבוא נתונים'}
            </h3>
            
            <div className="space-y-4">
              {showModal === 'user' && (
                <>
                  <input placeholder="אימייל" className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, email: e.target.value})} />
                  <input placeholder="שם מלא" className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, full_name: e.target.value})} />
                  <select className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, role: e.target.value})}>
                    <option value="COMPANY_SGT">רס"פ (פלוגה)</option>
                    <option value="LOGI_OFFICER">קל"ג (גדוד)</option>
                    <option value="ADMIN">מנהל מערכת</option>
                  </select>
                  <input placeholder="פלוגה" className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, company: e.target.value})} />
                </>
              )}
              {showModal === 'item' && (
                <>
                  <input placeholder="שם הפריט" className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, name: e.target.value})} />
                  <input placeholder={'מק"ט / מזהה'} className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, internal_id: e.target.value})} />
                  <input placeholder="קטגוריה" className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, category: e.target.value})} />
                  <input placeholder="כמות התחלתית במלאי" type="number" className="w-full p-4 bg-slate-50 border rounded-2xl" onChange={e => setNewData({...newData, qty: e.target.value})} />
                </>
              )}
              {showModal === 'import' && (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-4">
                  <Database size={48} className="mx-auto text-slate-300" />
                  <p className="text-sm text-slate-500 font-bold">גרור לכאן קובץ CSV או לחץ לבחירה</p>
                  <input type="file" className="hidden" id="csv-upload" accept=".csv,.xlsx" onChange={async (e) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const data = new Uint8Array(event.target.result);
                      const workbook = window.XLSX.read(data, { type: 'array' });
                      const firstSheet = workbook.SheetNames[0];
                      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
                      
                      alert(`נקראו ${rows.length} שורות מהקובץ. מעלה ל-Cloud...`);
                      
                      for (const row of rows) {
                        // Hebrew Mapping: מק"ט, פריט, קטגוריה, סוג מעקב
                        const itemId = row['מק"ט'] || row.internal_id;
                        const itemName = row['פריט'] || row.name;
                        
                        if (itemName && itemId) {
                          await addItemToCatalog({
                            name: itemName,
                            internal_id: itemId.toString(),
                            category: row['קטגוריה'] || row.category || 'כללי',
                            tracking: row['סוג מעקב'] || row.tracking || 'כמותי'
                          });
                        }
                      }
                      alert("הייבוא הושלם בהצלחה!");
                      setShowModal(null);
                    };
                    reader.readAsArrayBuffer(file);
                  }} />
                  <button onClick={() => document.getElementById('csv-upload').click()} className="btn-primary w-full py-4 rounded-2xl">בחר קובץ</button>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-4">
              <button 
                onClick={showModal === 'user' ? handleAddUser : showModal === 'item' ? handleAddItem : () => setShowModal(null)} 
                className="btn-primary flex-1 py-4 rounded-2xl font-black"
              >
                אישור ושמירה
              </button>
              <button onClick={() => setShowModal(null)} className="flex-1 py-4 text-slate-400 font-bold">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
