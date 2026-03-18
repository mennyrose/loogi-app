import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Package, ShoppingCart, Truck, CheckCircle, AlertCircle, 
  RotateCcw, User, LayoutDashboard, Database, ClipboardList, Plus, 
  LogOut, Menu, X, ChevronDown, ArrowUpRight, ShoppingBag, Users,
  ShieldCheck, Settings, Trash2, Edit2, UserPlus, Info, FileText,
  MessageSquare, Download, BarChart2, Briefcase, History, Upload, Image as ImageIcon, Save,
  ArrowRight, CreditCard, PenTool, Check, ChevronLeft, ExternalLink, RefreshCw
} from 'lucide-react';

// --- FIREBASE & SERVICES ---
import { auth, googleProvider, db } from './firebase';
import { signInWithRedirect, onAuthStateChanged, signOut, getRedirectResult, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  seedInitialData, 
  subscribeToCollection, 
  subscribeToInventory, 
  getUserByEmail,
  updateInventoryInFirestore,
  addRequestToFirestore,
  updateRequestStatusInFirestore,
  addUserToFirestore
} from './services/dataService';

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
  battalion: [{ item_id: 'i1', qty: 45, min: 10 }, { item_id: 'i2', qty: 30, min: 5 }],
  companies: { 'אלפא': [{ item_id: 'i1', qty: 120 }], 'בזלת': [], 'גולן': [], 'דקל': [], 'מפקדה': [] }
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
const IssuingModule = ({ catalog, inventory }) => {
  const [step, setStep] = useState('ACTION');
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
    if (existing) setCart(cart.map(c => c.internal_id === item.internal_id ? { ...c, qty: c.qty + qty } : c));
    else setCart([...cart, { ...item, qty }]);
  };

  const handleConfirm = async () => {
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
      }
    });

    await updateInventoryInFirestore({ battalion: newBattalion, companies: newCompanies });
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
            <input className="input-clean pr-14 bg-white text-sm shadow-sm" placeholder='חיפוש חופשי (לפי שם או מק"ט)...' value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div key={item.internal_id} className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className="flex-1 mb-4">
                  <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-black text-slate-300 tracking-tighter uppercase">{item.sku}</span><Badge variant="gold">{item.category}</Badge></div>
                  <h5 className="font-black text-slate-800 text-sm">{item.name}</h5>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                  <input type="number" defaultValue={1} min={1} id={`qty-${item.internal_id}`} className="flex-1 p-2 bg-slate-50 border rounded-xl text-center font-black outline-none focus:ring-2 focus:ring-idf-primary/20" />
                  <button onClick={() => { 
                    const q = parseInt(document.getElementById(`qty-${item.internal_id}`).value);
                    addToCart(item, q);
                  }} className="bg-idf-dark p-2.5 rounded-xl text-white hover:bg-idf-primary transition-all"><Plus size={20} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {cart.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-idf-dark text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-8 animate-slide-up z-[100]">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-idf-primary rounded-2xl flex items-center justify-center font-black text-lg">{cart.length}</div><span className="font-black text-sm">פריטים בעגלה</span></div>
          <button onClick={() => setStep('CHECKOUT')} className="bg-idf-primary px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg">סיכום ואישור</button>
        </div>
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
                  <div><p className="font-black text-slate-800 text-sm">{item.name}</p></div>
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

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState({ battalion: [], companies: {} });
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('requests');

  useEffect(() => {
    // Force Persistence for stable sessions
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 10000);

    // Explicitly handle Redirect Result for Vercel stability
    getRedirectResult(auth).catch(console.error);

    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          // Attempt to fetch user data from Firestore with a 5s cutoff
          const dbPromise = getUserByEmail(authUser.email);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
          
          const userData = await Promise.race([dbPromise, timeoutPromise]);
          
          if (userData) {
            setUser({ ...authUser, ...userData });
          } else {
            // New user or missing from DB - allow entry with default role
            const newUser = { email: authUser.email, full_name: authUser.displayName || 'משתמש חדש', role: 'COMPANY_SGT', company: 'אלפא' };
            setUser({ ...authUser, ...newUser });
          }
        } catch (err) {
          console.error("Auth DB Error:", err);
          // Fallback allow
          setUser({ ...authUser, role: 'COMPANY_SGT', company: 'אלפא', full_name: authUser.displayName });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
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
      unsubAuth(); unsubCatalog(); unsubInventory(); unsubRequests(); unsubUsers(); 
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      alert("שגיאת התחברות: " + error.message);
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
              { id: 'requests', label: 'דרישות', icon: ShoppingCart },
              { id: 'issuing', label: 'ניפוק פריטים', icon: Truck },
              { id: 'inventory', label: 'מלאי גדודי', icon: LayoutDashboard },
              { id: 'mgmt', label: 'ניהול מערכת', icon: Settings },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-3 px-8 py-5 font-black text-xs transition-all border-b-4 -mb-[2px] ${activeTab === t.id ? 'text-idf-primary border-idf-primary' : 'text-slate-400 border-transparent hover:text-slate-700'}`}>
                <t.icon size={18} />{t.label}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'requests' && (
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-black border-b text-[10px] uppercase">
                    <tr><th className="p-6">מתי</th><th className="p-6">פלוגה</th><th className="p-6">פריט</th><th className="p-6 text-left">סטטוס</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {requests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50"><td className="p-6">{req.time}</td><td className="p-6">{req.company}</td><td className="p-6 font-black">{catalog.find(c => c.internal_id === req.item_id)?.name}</td><td className="p-6 text-left"><Badge variant={req.status === 'PENDING' ? 'warning' : 'success'}>{req.status}</Badge></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'issuing' && <IssuingModule catalog={catalog} inventory={inventory} />}
            {activeTab === 'inventory' && (
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-black border-b text-[10px] uppercase">
                    <tr><th className="p-6">פריט</th><th className="p-6 text-center">כמות</th><th className="p-6 text-left">סטטוס</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventory.battalion.map(inv => (
                      <tr key={inv.item_id} className="hover:bg-slate-50"><td className="p-6 font-black">{catalog.find(c => c.internal_id === inv.item_id)?.name}</td><td className="p-6 text-center font-black text-xl text-idf-primary">{inv.qty}</td><td className="p-6 text-left"><Badge variant="success">תקין</Badge></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'mgmt' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                  <h4 className="font-black border-b pb-4">נתוני קטלוג גדודי</h4>
                  <div className="space-y-2">
                    {catalog.map(item => <div key={item.internal_id} className="flex justify-between p-3 bg-slate-50 rounded-xl"><span>{item.name}</span><span className="text-slate-300 font-bold">{item.sku}</span></div>)}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                  <h4 className="font-black border-b pb-4">ניהול משתמשים</h4>
                  <div className="space-y-2">
                    {users.map(u => <div key={u.email} className="flex justify-between p-3 bg-slate-50 rounded-xl"><span>{u.full_name}</span><Badge>{ROLE_LABELS[u.role]}</Badge></div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full border shadow-sm z-50">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest tracking-[0.2em]">L∞Giz v2.6 Live Cloud</span>
      </div>
    </div>
  );
}
