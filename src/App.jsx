import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Package, ShoppingCart, Truck, CheckCircle, AlertCircle, 
  RotateCcw, User, LayoutDashboard, Database, ClipboardList, Plus, 
  LogOut, Menu, X, ChevronDown, ArrowUpRight, ShoppingBag, Users,
  ShieldCheck, Settings, Trash2, Edit2, UserPlus, Info, FileText,
  MessageSquare, Download, BarChart2, Briefcase, History, Upload, Image as ImageIcon, Save,
  ArrowRight, CreditCard, PenTool, Check, ChevronLeft, ExternalLink
} from 'lucide-react';

// --- ROLES & CONSTANTS ---
const ROLE_LABELS = {
  LOGI_OFFICER: 'קל"ג',
  LOGISTICS_TEAM: 'לוגיסטיקה',
  COMPANY_SGT: 'נציג פלוגה',
  ADMIN: 'אדמין'
};

const COMPANIES = ['אלפא', 'בזלת', 'גולן', 'דקל', 'מפקדה'];

const ACTION_TYPES = [
  { id: 'ISSUE_TO_CO', label: 'ניפוק לפלוגה' },
  { id: 'RETURN_FROM_CO', label: 'החזרה מפלוגה' },
  { id: 'RECEIVE_FROM_BDE', label: 'קבלה מהחטיבה' },
  { id: 'RETURN_TO_BDE', label: 'החזרה לחטיבה' },
  { id: 'SCRAP_LAUNDRY', label: 'העברה לבלאי/כביסה' },
];

// --- INITIAL SEED DATA ---
const INITIAL_USERS = [
  { id: 'u1', email: 'qalag@idf.il', full_name: 'יוסי כהן', role: 'LOGI_OFFICER', company: 'מפקדה' },
  { id: 'u2', email: 'rasap.alfa@idf.il', full_name: 'אבי לוי', role: 'COMPANY_SGT', company: 'אלפא' },
  { id: 'u3', email: 'admin@loogiz.com', full_name: 'מנהל מערכת', role: 'ADMIN', company: 'מנהלה' },
];

const INITIAL_CATALOG = [
  { internal_id: 'i1', sku: '600100', name: 'וסט לוחם "דורון"', category: 'צל"ם אישי', type: 'קבוע', tracking: 'סריאלי' },
  { internal_id: 'i2', sku: '600101', name: 'קסדה טקטית', category: 'צל"ם אישי', type: 'קבוע', tracking: 'סריאלי' },
  { internal_id: 'i3', sku: '200400', name: 'מדי ב\' ריפסטופ', category: 'טקסטיל', type: 'מתכלה', tracking: 'כמותי' },
  { internal_id: 'i4', sku: '200401', name: 'גרביים תרמיות', category: 'טקסטיל', type: 'מתכלה', tracking: 'כמותי' },
  { internal_id: 'i5', sku: '800500', name: 'גנרטור 5KVA', category: 'מחנה ושהייה', type: 'קבוע', tracking: 'סריאלי' },
  { internal_id: 'i6', sku: '110200', name: 'ערכת היגיינה', category: 'מתכלים', type: 'מתכלה', tracking: 'כמותי' },
];

const INITIAL_INVENTORY = {
  battalion: [
    { item_id: 'i1', qty: 45, min: 10 },
    { item_id: 'i2', qty: 30, min: 5 },
    { item_id: 'i3', qty: 200, min: 50 },
    { item_id: 'i4', qty: 500, min: 100 },
    { item_id: 'i5', qty: 2, min: 1 },
    { item_id: 'i6', qty: 150, min: 20 },
  ],
  companies: {
    'אלפא': [{ item_id: 'i1', qty: 120 }, { item_id: 'i3', qty: 200 }],
    'בזלת': [{ item_id: 'i1', qty: 110 }],
    'גולן': [],
    'דקל': [],
    'מפקדה': []
  }
};

const INITIAL_REQUESTS = [
  { id: 'req1', time: '14:20', company: 'אלפא', item_id: 'i1', qty: 10, status: 'PENDING' },
  { id: 'req2', time: '12:35', company: 'בזלת', item_id: 'i2', qty: 5, status: 'PENDING' },
];

// --- COMPONENTS ---

const Logo = () => (
  <div className="flex items-center gap-3">
    <img 
      src="file:///C:/Users/user/.gemini/antigravity/brain/d0625862-32fb-4364-acc5-a58a545f87a8/media__1773767289130.png" 
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

// --- ISSUING MODULE (v2.5) ---
const IssuingModule = ({ catalog, inventory, updateInventory }) => {
  const [step, setStep] = useState('ACTION'); // ACTION, SELECT, CHECKOUT, RECEIPT
  const [action, setAction] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [targetCompany, setTargetCompany] = useState('אלפא');
  const [receiverDetails, setReceiverDetails] = useState({ id: '', name: '', unit: '' });
  const [signature, setSignature] = useState(false);

  const categories = useMemo(() => [...new Set(catalog.map(i => i.category))], [catalog]);

  const filteredItems = useMemo(() => {
    return catalog
      .filter(i => (!selectedCategory || i.category === selectedCategory) && (i.name.includes(search) || i.sku.includes(search)))
      .sort((a,b) => a.name.localeCompare(b.name, 'he'));
  }, [catalog, selectedCategory, search]);

  const addToCart = (item, qty) => {
    const existing = cart.find(c => c.internal_id === item.internal_id);
    if (existing) {
      setCart(cart.map(c => c.internal_id === item.internal_id ? { ...c, qty: c.qty + qty } : c));
    } else {
      setCart([...cart, { ...item, qty }]);
    }
  };

  const removeFromCart = (id) => setCart(cart.filter(c => c.internal_id !== id));

  const handleReceiverId = (val) => {
    setReceiverDetails({ ...receiverDetails, id: val });
    if (val.length === 7) {
      setReceiverDetails({ id: val, name: "ישראל ישראלי", unit: "מילואימניק גאה" });
    }
  };

  const handleConfirm = () => {
    let newBattalion = [...inventory.battalion];
    let newCompanies = { ...inventory.companies };

    cart.forEach(item => {
      const bIdx = newBattalion.findIndex(i => i.item_id === item.internal_id);
      
      if (action === 'ISSUE_TO_CO') {
        if (bIdx > -1) newBattalion[bIdx].qty -= item.qty;
        if (!newCompanies[targetCompany]) newCompanies[targetCompany] = [];
        const cIdx = newCompanies[targetCompany].findIndex(i => i.item_id === item.internal_id);
        if (cIdx > -1) newCompanies[targetCompany][cIdx].qty += item.qty;
        else newCompanies[targetCompany].push({ item_id: item.internal_id, qty: item.qty });
      } else if (action === 'RETURN_FROM_CO') {
        if (bIdx > -1) newBattalion[bIdx].qty += item.qty;
        const cIdx = newCompanies[targetCompany].findIndex(i => i.item_id === item.internal_id);
        if (cIdx > -1) newCompanies[targetCompany][cIdx].qty -= item.qty;
      } else if (action === 'RECEIVE_FROM_BDE') {
        if (bIdx > -1) newBattalion[bIdx].qty += item.qty;
        else newBattalion.push({ item_id: item.internal_id, qty: item.qty, min: 5 });
      }
    });

    updateInventory({ battalion: newBattalion, companies: newCompanies });
    setStep('RECEIPT');
  };

  if (step === 'ACTION') return (
    <div className="max-w-xl mx-auto space-y-4 animate-slide-up bg-white p-8 rounded-3xl border shadow-sm">
      <h3 className="text-xl font-black mb-8 border-b pb-4 text-idf-dark">בחירת סוג ניפוק / פעולה</h3>
      <div className="grid grid-cols-1 gap-3">
        {ACTION_TYPES.map(a => (
          <button key={a.id} onClick={() => { setAction(a.id); setStep('SELECT'); }} className="flex justify-between items-center p-5 bg-slate-50 hover:bg-idf-primary hover:text-white rounded-2xl transition-all group border border-slate-100 shadow-sm hover:shadow-md">
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
            <p className="text-[10px] font-bold text-slate-400">בחר פריטים להוספה לעגלה</p>
          </div>
        </div>
        {(action === 'ISSUE_TO_CO' || action === 'RETURN_FROM_CO') && (
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border w-full md:w-auto">
            <span className="text-[10px] font-black text-slate-400 pr-2">עבור:</span>
            <select value={targetCompany} onChange={e => setTargetCompany(e.target.value)} className="bg-transparent font-black text-sm outline-none">
              {COMPANIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
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
            <input 
              className="input-clean pr-14 bg-white text-sm shadow-sm" 
              placeholder='חיפוש חופשי (לפי שם או מק"ט)...' 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div key={item.internal_id} className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className="flex-1 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-black text-slate-300 tracking-tighter uppercase">{item.sku}</span>
                    <Badge variant="gold">{item.category}</Badge>
                  </div>
                  <h5 className="font-black text-slate-800 text-sm">{item.name}</h5>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                  <input 
                    type="number" 
                    defaultValue={1} 
                    min={1} 
                    id={`qty-${item.internal_id}`} 
                    className="flex-1 p-2 bg-slate-50 border rounded-xl text-center font-black outline-none focus:ring-2 focus:ring-idf-primary/20" 
                  />
                  <button onClick={() => { 
                    const q = parseInt(document.getElementById(`qty-${item.internal_id}`).value);
                    addToCart(item, q);
                  }} className="bg-idf-dark p-2.5 rounded-xl text-white hover:bg-idf-primary transition-all shadow-md active:scale-95">
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-idf-dark text-white px-10 py-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 animate-slide-up z-[100] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-idf-primary rounded-2xl flex items-center justify-center font-black text-lg">{cart.length}</div>
            <span className="font-black text-sm">פריטים הממתינים בעגלה</span>
          </div>
          <button onClick={() => setStep('CHECKOUT')} className="bg-idf-primary px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-idf-primary/30">סיכום ואישור</button>
        </div>
      )}
    </div>
  );

  if (step === 'CHECKOUT') return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-32">
      <div className="bg-white rounded-[2.5rem] border shadow-2xl overflow-hidden">
        <div className="p-8 bg-slate-50 border-b flex justify-between items-center">
          <h3 className="text-2xl font-black">סיכום פעולת ניפוק</h3>
          <Badge variant="gold">{ACTION_TYPES.find(a => a.id === action)?.label}</Badge>
        </div>
        
        <div className="p-8 grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-6">
            <h4 className="font-black text-slate-400 text-xs uppercase tracking-widest">פריטים המיועדים לניפוק</h4>
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.internal_id} className="flex justify-between items-center p-5 bg-white border rounded-2xl shadow-sm italic transition-all hover:border-idf-primary group">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-black text-lg text-idf-primary">x {item.qty}</span>
                    <button onClick={() => removeFromCart(item.internal_id)} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
             <div className="space-y-4">
                <h4 className="font-black text-xs text-slate-500 uppercase tracking-widest">פרטי מקבל</h4>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input className="input-clean pr-12 text-sm font-bold bg-white" placeholder="מספר אישי (7 ספרות)" value={receiverDetails.id} onChange={e => handleReceiverId(e.target.value)} />
                </div>
                {receiverDetails.name && (
                  <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 animate-fade-in flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600"><Check size={20} /></div>
                    <div>
                      <p className="font-black text-emerald-800 text-sm">{receiverDetails.name}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">{receiverDetails.unit}</p>
                    </div>
                  </div>
                )}
             </div>

             <div className="space-y-4">
                <h4 className="font-black text-xs text-slate-500 uppercase tracking-widest">חתימה</h4>
                <div className="h-48 bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-300 cursor-pointer hover:border-idf-primary/40 transition-all relative overflow-hidden group" onClick={() => setSignature(true)}>
                  {signature ? (
                    <div className="w-full h-full flex items-center justify-center font-cursive text-4xl text-slate-800 animate-fade-in bg-slate-50/30">ישראל ישראלי</div>
                  ) : (
                    <>
                      <PenTool size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase">לחץ כאן לחתימה</span>
                    </>
                  )}
                </div>
             </div>

             <div className="flex flex-col gap-3 pt-4">
                <button onClick={handleConfirm} disabled={!signature || !receiverDetails.name} className="w-full btn-primary justify-center py-5 text-sm disabled:opacity-30 disabled:grayscale">אשר ניפוק והפק קבלה</button>
                <button onClick={() => setStep('SELECT')} className="w-full font-black text-slate-400 text-[10px] uppercase tracking-widest hover:text-idf-dark transition-colors py-2">חזרה לתיקון עגלה</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (step === 'RECEIPT') return (
    <div className="max-w-md mx-auto space-y-6 animate-slide-up bg-white p-12 rounded-[3.5rem] border-8 border-idf-primary/5 shadow-[0_50px_100px_rgba(0,0,0,0.1)] text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-idf-primary/5 rounded-bl-[100px] -z-10 rotate-12"></div>
      <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/30 rotate-3"><Check size={50} strokeWidth={3} /></div>
      <h3 className="text-4xl font-black mb-2 text-idf-dark tracking-tighter">בוצע בהצלחה!</h3>
      <p className="text-slate-400 font-bold mb-10 text-xs uppercase tracking-[.3em]">קבלה אלקטרונית #{Math.floor(Math.random()*1000000)}</p>
      
      <div className="text-right space-y-4 bg-slate-50/80 p-8 rounded-3xl border border-slate-100 mb-10">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <span className="text-[10px] font-black text-slate-400">יעד:</span>
          <span className="font-black text-idf-primary">פלוגת {targetCompany}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400">מקבל:</span>
          <span className="font-black text-sm text-slate-700">{receiverDetails.name}</span>
        </div>
      </div>

      <button onClick={() => { setStep('ACTION'); setCart([]); setSignature(false); setReceiverDetails({id:'', name:'', unit:''}); }} className="w-full btn-primary justify-center py-6 rounded-3xl text-lg shadow-xl shadow-idf-primary/30">ניפוק חדש</button>
    </div>
  );
};

// --- REQUESTS MANAGMENT (v2.5) ---
const RequestsManagement = ({ requests, inventory, catalog, updateData }) => {
  const getStock = (id) => inventory.battalion.find(i => i.item_id === id)?.qty || 0;
  
  const handleAction = (reqId, type) => {
    // type: 'APPROVE', 'BRIGADE'
    const newRequests = requests.map(r => r.id === reqId ? { ...r, status: type === 'APPROVE' ? 'COMPLETED' : 'ESCALATED' } : r);
    updateData({ requests: newRequests });
    alert(type === 'APPROVE' ? "דרישה אושרה" : "דרישה הועברה לטיפול חטיבתי");
  };

  return (
    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
      <table className="w-full text-right text-sm">
        <thead className="bg-slate-50 text-slate-400 font-black border-b text-[10px] uppercase tracking-widest">
          <tr>
            <th className="p-6">מתי</th>
            <th className="p-6">פלוגה</th>
            <th className="p-6">פריט</th>
            <th className="p-6">מלאי גדודי</th>
            <th className="p-6">כמות מבוקשת</th>
            <th className="p-6 text-left">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.filter(r => r.status === 'PENDING').map(req => {
            const item = catalog.find(c => c.internal_id === req.item_id);
            const stock = getStock(req.item_id);
            const canFulfill = stock >= req.qty;
            
            return (
              <tr key={req.id} className="hover:bg-slate-50 transition-all font-medium group">
                <td className="p-6 text-slate-400 font-bold">{req.time}</td>
                <td className="p-6 font-black text-idf-primary">{req.company}</td>
                <td className="p-6 font-black text-slate-700">{item?.name}</td>
                <td className="p-6">
                  <div className={`flex items-center gap-2 font-black ${stock < 5 ? 'text-rose-500' : 'text-slate-400'}`}>
                    <Database size={14} />
                    {stock}
                  </div>
                </td>
                <td className="p-6 bg-slate-50/50 font-black text-lg">{req.qty}</td>
                <td className="p-6 text-left">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleAction(req.id, 'APPROVE')} 
                      disabled={!canFulfill}
                      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${canFulfill ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:scale-105' : 'bg-slate-100 text-slate-300 backdrop-grayscale'}`}
                    >אשר ניפוק</button>
                    <button 
                      onClick={() => handleAction(req.id, 'BRIGADE')}
                      className="px-4 py-2 bg-idf-dark text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-idf-dark/20 hover:scale-105 transition-all"
                    >העבר לחטיבה</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {requests.filter(r => r.status === 'PENDING').length === 0 && (
         <div className="p-20 text-center text-slate-300 font-black italic">אין דרישות הממתינות לטיפול</div>
      )}
    </div>
  );
};

// --- INVENTORY COMPONENT ---
const GroupedInventory = ({ inventory, catalog }) => {
  const [selectedCat, setSelectedCat] = useState(null);
  const categories = useMemo(() => [...new Set(catalog.map(i => i.category))], [catalog]);

  const filteredItems = inventory.filter(inv => {
    const item = catalog.find(c => c.internal_id === inv.item_id);
    return !selectedCat || item?.category === selectedCat;
  }).sort((a,b) => {
    const itemA = catalog.find(c => c.internal_id === a.item_id)?.name || '';
    const itemB = catalog.find(c => c.internal_id === b.item_id)?.name || '';
    return itemA.localeCompare(itemB, 'he');
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto no-scrollbar border">
        <button onClick={() => setSelectedCat(null)} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${!selectedCat ? 'bg-white shadow-md text-idf-primary' : 'text-slate-400 hover:text-slate-600'}`}>הכל</button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCat(cat)} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all whitespace-nowrap ${selectedCat === cat ? 'bg-white shadow-md text-idf-primary' : 'text-slate-400 hover:text-slate-600'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-400 font-black border-b uppercase tracking-widest text-[9px]">
            <tr><th className="p-6">פריט</th><th className="p-6 text-center">מק"ט</th><th className="p-6 text-center">כמות במלאי</th><th className="p-6 text-left">סטטוס</th></tr>
          </thead>
          <tbody className="divide-y font-medium">
            {filteredItems.map(inv => {
              const item = catalog.find(c => c.internal_id === inv.item_id);
              const isLow = inv.qty < (inv.min || 5);
              return (
                <tr key={inv.item_id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 font-black text-slate-800">{item?.name}</td>
                  <td className="p-6 text-center font-mono text-slate-300 text-xs">{item?.sku}</td>
                  <td className={`p-6 text-center font-black text-xl ${isLow ? 'text-rose-500' : 'text-idf-primary'}`}>{inv.qty}</td>
                  <td className="p-6 text-left"><Badge variant={isLow ? 'danger' : 'success'}>{isLow ? 'מלאי נמוך' : 'תקין'}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- ADMIN PANEL ---
const AdminPanel = ({ data, updateData }) => {
  const { users, catalog } = data;
  const [adminTab, setAdminTab] = useState('users');
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'COMPANY_SGT', company: 'אלפא' });

  const handleAddUser = () => {
    if (!newUser.email || !newUser.full_name) return alert("נא למלא אימייל ושם מלא");
    updateData({ users: [...users, { ...newUser, id: Date.now().toString() }] });
    setNewUser({ email: '', full_name: '', role: 'COMPANY_SGT', company: 'אלפא' });
    alert("משתמש נוסף בהצלחה!");
  };

  const downloadSampleCSV = () => {
    // UTF-8 with BOM (\uFEFF) for Excel Hebrew support
    const header = "internal_id,sku,name,category,type,tracking\n";
    const body = "i_new,100200,וסט קרמי חדש,צל\"ם,קבוע,סריאלי\ni_new2,200300,חולצת מילואים,טקסטיל,מתכלה,כמותי";
    const content = "\uFEFF" + header + body;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "LooGiz_Catalog_Sample.csv");
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex gap-2 bg-slate-100 p-1.5 rounded-[1.25rem] w-fit border shadow-inner">
        <button onClick={() => setAdminTab('users')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${adminTab === 'users' ? 'bg-white shadow-md text-idf-primary' : 'text-slate-400 hover:text-slate-600'}`}>ניהול משתמשים</button>
        <button onClick={() => setAdminTab('catalog')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${adminTab === 'catalog' ? 'bg-white shadow-md text-idf-primary' : 'text-slate-400 hover:text-slate-600'}`}>ניהול קטלוג</button>
        <button onClick={() => setAdminTab('system')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${adminTab === 'system' ? 'bg-white shadow-md text-idf-primary' : 'text-slate-400 hover:text-slate-600'}`}>הגדרות מערכת</button>
      </div>

      {adminTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden">
             <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b font-black text-slate-400 uppercase tracking-widest text-[9px]">
                  <tr><th className="p-6">אימייל (Google)</th><th className="p-6">שם מלא</th><th className="p-6">תפקיד</th><th className="p-6 text-left">פעולות</th></tr>
                </thead>
                <tbody className="divide-y font-bold text-slate-600">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black text-idf-primary">{u.email}</td>
                      <td className="p-6 text-slate-800">{u.full_name}</td>
                      <td className="p-6"><Badge>{ROLE_LABELS[u.role]}</Badge> {u.role === 'COMPANY_SGT' && <span className="text-slate-300 font-medium mr-2">/ {u.company}</span>}</td>
                      <td className="p-6 text-left"><button className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <div className="w-10 h-10 bg-idf-primary/10 rounded-xl flex items-center justify-center text-idf-primary"><UserPlus size={20} /></div>
              <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest">משתמש חדש</h4>
            </div>
            <div className="space-y-4">
              <input className="input-clean text-sm font-bold bg-slate-50/50" placeholder="כתובת אימייל" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <input className="input-clean text-sm font-bold bg-slate-50/50" placeholder="שם מלא" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} />
              <select className="input-clean text-sm font-black bg-slate-50/50" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                {Object.entries(ROLE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {newUser.role === 'COMPANY_SGT' && (
                <select className="input-clean text-sm font-black bg-slate-50/50 border-idf-primary/20" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})}>
                   {COMPANIES.map(c => <option key={c}>{c}</option>)}
                </select>
              )}
              <button 
                className="w-full btn-primary justify-center py-5 mt-6 shadow-xl shadow-idf-primary/30"
                onClick={handleAddUser}
              >צור משתמש מערכת</button>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'catalog' && (
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-fade-in">
           <div className="p-8 bg-slate-50 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-idf-dark text-white rounded-xl flex items-center justify-center"><LayoutDashboard size={20} /></div>
                <span className="font-black text-idf-dark text-sm uppercase tracking-widest">ניהול קטלוג אב</span>
              </div>
              <div className="flex gap-4">
                <button onClick={downloadSampleCSV} className="text-[10px] font-black border bg-white px-6 py-3 rounded-2xl hover:shadow-lg flex items-center gap-3 transition-all outline-none text-slate-500">
                  <Download size={16} className="text-idf-primary" /> הורד פורמט אקסל (עברית)
                </button>
                <button className="text-[10px] font-black bg-idf-dark text-white px-6 py-3 rounded-2xl hover:bg-idf-primary transition-all flex items-center gap-3 shadow-lg shadow-idf-dark/20 outline-none">
                  <Upload size={16} /> ייבוא קטלוג מהיר
                </button>
              </div>
           </div>
           <table className="w-full text-right text-xs">
              <thead className="bg-white border-b font-black text-slate-300 uppercase text-[9px] tracking-widest"><tr><th className="p-6">מק"ט</th><th className="p-6">שם הפריט</th><th className="p-6">קטגוריה</th><th className="p-6 text-left">פעולות</th></tr></thead>
              <tbody className="divide-y font-bold text-slate-600">
                {catalog.map(item => (
                   <tr key={item.internal_id} className="hover:bg-slate-50 transition-all group">
                     <td className="p-6 font-black text-slate-300">{item.sku}</td>
                     <td className="p-6 font-black text-slate-800 text-sm group-hover:text-idf-primary transition-colors">{item.name}</td>
                     <td className="p-6"><Badge variant="gold">{item.category}</Badge></td>
                     <td className="p-6 text-left opacity-0 group-hover:opacity-100 transition-opacity"><button className="text-slate-200 hover:text-idf-primary ml-6"><Edit2 size={16} /></button> <button className="text-slate-200 hover:text-rose-500"><Trash2 size={16} /></button></td>
                   </tr>
                ))}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

// --- MAIN DASHBOARD ---
const QalagDashboard = ({ user, data, updateData }) => {
  const { requests, inventory, catalog } = data;
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedInventoryCo, setSelectedInventoryCo] = useState('אלפא');

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all">
            <div className="absolute top-0 right-0 w-3 h-full bg-idf-primary"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">דרישות רס"פים</p>
            <h3 className="text-6xl font-black text-idf-dark tracking-tighter">{requests.filter(r => r.status === 'PENDING').length}</h3>
          </div>
          <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all">
            <div className="absolute top-0 right-0 w-3 h-full bg-emerald-500"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">כשירות מלאי גדודי</p>
            <h3 className="text-6xl font-black text-emerald-500 tracking-tighter">92%</h3>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <button onClick={() => setActiveTab('issuing')} className="flex flex-col items-center justify-center bg-idf-primary text-white rounded-[2rem] p-6 shadow-2xl shadow-idf-primary/30 hover:scale-105 active:scale-95 transition-all outline-none border-b-[6px] border-idf-dark/20"><Package size={36} /><span className="text-sm font-black mt-4">ניפוק (Issuing)</span></button>
          <button onClick={() => setActiveTab('inventory')} className="flex flex-col items-center justify-center bg-white border-2 border-slate-100 text-slate-600 rounded-[2rem] p-6 hover:shadow-xl transition-all font-black active:scale-95 shadow-sm group">
            <Database size={32} className="mb-3 text-idf-primary group-hover:scale-110 transition-transform" />
            <span className="text-[11px] uppercase tracking-widest">מלאי גדודי</span>
          </button>
          <button onClick={() => setActiveTab('co_inventory')} className="flex flex-col items-center justify-center bg-white border-2 border-slate-100 text-slate-600 rounded-[2rem] p-6 hover:shadow-xl transition-all font-black active:scale-95 shadow-sm group">
            <Users size={32} className="mb-3 text-idf-primary group-hover:scale-110 transition-transform" />
            <span className="text-[11px] uppercase tracking-widest">מלאי פלוגתי</span>
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b-2 border-slate-100 overflow-x-auto no-scrollbar">
        {[
          { id: 'requests', label: 'דרישות לטיפול', icon: ShoppingCart },
          { id: 'issuing', label: 'ניפוק פריטים', icon: Truck },
          { id: 'receipts', label: 'ארכיון קבלות', icon: FileText },
          { id: 'inventory', label: 'מצב מלאי גדודי', icon: LayoutDashboard },
          { id: 'mgmt', label: 'ניהול מערכת', icon: Settings },
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-3 px-8 py-5 font-black text-xs transition-all border-b-4 -mb-[2px] ${activeTab === t.id ? 'text-idf-primary border-idf-primary' : 'text-slate-400 border-transparent hover:text-slate-700'}`}
          >
            <t.icon size={18} />{t.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {activeTab === 'requests' && (
          <RequestsManagement 
            requests={requests} 
            inventory={inventory} 
            catalog={catalog} 
            updateData={updateData} 
          />
        )}
        
        {activeTab === 'issuing' && (
          <IssuingModule 
            catalog={catalog} 
            inventory={inventory} 
            updateInventory={inv => updateData({ inventory: inv })} 
          />
        )}

        {activeTab === 'inventory' && (
          <GroupedInventory inventory={inventory.battalion} catalog={catalog} />
        )}

        {activeTab === 'co_inventory' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-idf-primary/10 rounded-2xl flex items-center justify-center text-idf-primary"><Briefcase size={24} /></div>
                  <div>
                    <h3 className="font-black text-xl text-slate-800">מלאי פלוגות (ימ"ח)</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">תצוגה לפי פלוגה נבחרת</p>
                  </div>
                </div>
              <select value={selectedInventoryCo} onChange={e => setSelectedInventoryCo(e.target.value)} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-idf-primary outline-none focus:ring-2 focus:ring-idf-primary/20 appearance-none pr-10 relative cursor-pointer shadow-sm">
                {COMPANIES.map(c => <option key={c} value={c}>פלוגת {c}</option>)}
              </select>
            </div>
            <GroupedInventory 
              inventory={inventory.companies[selectedInventoryCo] || []} 
              catalog={catalog} 
            />
          </div>
        )}

        {activeTab === 'mgmt' && <AdminPanel data={data} updateData={updateData} />}
        
        {activeTab === 'receipts' && (
          <div className="bg-white p-24 text-center rounded-[3rem] border-4 border-dashed border-slate-100 text-slate-200 font-extrabold italic animate-pulse">
            <FileText size={80} strokeWidth={1} className="mx-auto mb-6 opacity-10" />
            ארכיון קבלות וחתימות דיגיטליות...
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ 
    catalog: INITIAL_CATALOG, 
    inventory: INITIAL_INVENTORY, 
    requests: INITIAL_REQUESTS,
    users: INITIAL_USERS 
  });

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-heebo text-right" dir="rtl">
      <div className="bg-white max-w-sm w-full rounded-[3.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.1)] border-8 border-idf-primary/5 overflow-hidden animate-fade-in p-14 text-center">
        <Logo />
        <p className="text-idf-primary text-[10px] font-black mt-6 mb-14 uppercase tracking-[0.5em] opacity-60">Battalion 6609 Logistics</p>
        <div className="space-y-4">
          <button onClick={() => setUser(INITIAL_USERS[0])} className="w-full btn-primary justify-center py-6 rounded-2xl text-lg shadow-2xl shadow-idf-primary/30">כניסת קל"ג (הזדהות)</button>
          <button onClick={() => setUser(INITIAL_USERS[1])} className="w-full bg-slate-50 text-idf-dark border border-slate-200 py-6 rounded-2xl font-black hover:bg-slate-100 transition-all active:scale-95 shadow-sm text-lg">כניסת רס"פ (פלוגה)</button>
          <div className="pt-10 flex flex-col items-center gap-2">
             <button onClick={() => setUser(INITIAL_USERS[2])} className="text-slate-300 text-[10px] font-black hover:text-idf-primary transition-all uppercase tracking-[0.3em] outline-none border-b border-transparent hover:border-idf-primary pb-1">Master Admin Login</button>
             <a href="#" className="flex items-center gap-1 text-[8px] font-black text-slate-300 hover:text-idf-primary grayscale hover:grayscale-0 transition-all">Support / <HelpCircle size={8} /></a>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] font-heebo text-right overflow-x-hidden selection:bg-idf-primary selection:text-white" dir="rtl">
      <header className="fixed top-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-2xl border-b border-slate-100 z-[100] px-10 flex justify-between items-center shadow-sm">
        <Logo />
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-5 border-l-2 pr-2 pl-8 border-slate-50">
              <div className="text-right leading-tight">
                <span className="text-slate-300 font-black text-[9px] uppercase tracking-[0.2em]">{ROLE_LABELS[user.role]} {user.role === 'COMPANY_SGT' && user.company}</span>
                <div className="text-idf-dark font-black text-base">{user.full_name}</div>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-idf-primary to-amber-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-idf-primary/20 border-2 border-white">{user.full_name[0]}</div>
           </div>
           <button onClick={() => setUser(null)} className="p-3 bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all shadow-sm"><LogOut size={22} /></button>
        </div>
      </header>
      <main className="pt-36 px-4 md:px-10 max-w-7xl mx-auto animate-fade-in pb-20">
        {user.role === 'LOGI_OFFICER' || user.role === 'ADMIN' ? (
          <QalagDashboard user={user} data={data} updateData={d => setData(p => ({...p, ...d}))} />
        ) : (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-24 h-24 bg-idf-primary/10 text-idf-primary rounded-full flex items-center justify-center mb-6 animate-pulse"><RotateCcw size={40} /></div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">ממשק רס"פ (V2.5)</h2>
            <p className="text-slate-400 font-bold italic">טוען נתונים פלוגתיים עבור פלוגת {user.company}...</p>
          </div>
        )}
      </main>
      
      {/* Floating System Info */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full border shadow-sm z-50">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">L∞Giz v2.5 Ready</span>
      </div>
    </div>
  );
}

const HelpCircle = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" id="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>;
