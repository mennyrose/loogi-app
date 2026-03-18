/**
 * AI Service for Logi-6609
 * Provides analytical functions and "AI-like" responses based on real-time data.
 */

// Consumption Rate Calculation (Endurance)
export const calculateConsumptionRate = (transactions, itemId, days = 7) => {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - days);

  const relevantTx = transactions.filter(tx => 
    tx.type === 'ISSUE_TO_CO' && 
    new Date(tx.timestamp) >= cutoff &&
    tx.items.some(i => i.item_id === itemId)
  );

  const totalIssued = relevantTx.reduce((sum, tx) => {
    const item = tx.items.find(i => i.item_id === itemId);
    return sum + (item ? item.qty : 0);
  }, 0);

  const dailyRate = totalIssued / days;
  return { dailyRate, totalIssued, periodDays: days };
};

// Cross-Company Comparison
export const getCrossCompanyComparison = (inventory, itemId) => {
  const comparison = [];
  
  // Battalion Stock
  const bItem = inventory.battalion.find(i => i.item_id === itemId);
  comparison.push({ location: 'מחסן גדוד', qty: bItem ? bItem.qty : 0 });

  // Company Stocks
  Object.entries(inventory.companies).forEach(([comp, items]) => {
    const item = items.find(i => i.item_id === itemId);
    comparison.push({ location: `פלוגה ${comp}`, qty: item ? item.qty : 0 });
  });

  return comparison;
};

// Identify Inventory Gaps (Requests vs Stock)
export const identifyGaps = (catalog, inventory, requests) => {
  return catalog.map(item => {
    const bStock = inventory.battalion.find(i => i.item_id === item.internal_id)?.qty || 0;
    const pendingReqQty = requests
      .filter(r => r.item_id === item.internal_id && r.status !== 'ISSUED')
      .reduce((a, b) => a + (b.qty || 0), 0);
    
    return {
      name: item.name,
      id: item.internal_id,
      stock: bStock,
      pending: pendingReqQty,
      gap: bStock - pendingReqQty
    };
  }).filter(g => g.gap < 0 || g.pending > 0);
};

// Export Data to Excel
export const exportToExcel = (data, fileName = 'LogiReport.xlsx') => {
  if (!window.XLSX) return console.error('SheetJS not loaded');
  
  const ws = window.XLSX.utils.json_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Data');
  window.XLSX.writeFile(wb, fileName);
};

// Main AI Process Function
export const processQuery = (query, context) => {
  const { catalog, inventory, requests, transactions } = context;
  const q = query.toLowerCase();

  // 1. Check for "מילוי" / "קצב צריכה"
  if (q.includes('קצב') || q.includes('צריכה') || q.includes('מתי ייגמר')) {
    const consumables = catalog.filter(i => i.tracking === 'כמותי');
    let results = consumables.map(item => {
      const stats = calculateConsumptionRate(transactions, item.internal_id);
      const stock = inventory.battalion.find(i => i.item_id === item.internal_id)?.qty || 0;
      const daysLeft = stats.dailyRate > 0 ? Math.floor(stock / stats.dailyRate) : 'אין צריכה';
      return { פריט: item.name, 'מלאי נוכחי': stock, 'קצב יומי': stats.dailyRate.toFixed(2), 'ימים לסיום': daysLeft };
    });
    
    return {
      text: "ניתחתי את קצב הצריכה של הפריטים המתכלים בשבוע האחרון. הנה התחזית שלי:",
      data: results,
      type: 'CONSUMPTION'
    };
  }

  // 2. Check for "השוואה"
  if (q.includes('השוואה')) {
    const itemName = q.split('השוואה')[1]?.trim();
    const item = catalog.find(i => i.name.includes(itemName) || itemName?.includes(i.name));
    
    if (item) {
      const comp = getCrossCompanyComparison(inventory, item.internal_id);
      return {
        text: `הנה פירוט המצאי של ${item.name} בכלל היחידות:`,
        data: comp.map(c => ({ מיקום: c.location, כמות: c.qty })),
        type: 'COMPARISON'
      };
    }
  }

  // 3. Check for "פערים" / "מה חסר"
  if (q.includes('פער') || q.includes('חסר')) {
    const gaps = identifyGaps(catalog, inventory, requests);
    return {
      text: "אלו הפריטים שיש עבורם דרישות פתוחות או פער במלאי הגדודי:",
      data: gaps.map(g => ({ פריט: g.name, מלאי: g.stock, דרישות: g.pending, פער: g.gap })),
      type: 'GAPS'
    };
  }

  return {
    text: "אני לא בטוח שהבנתי. תוכל לשאול על קצב צריכה, להשוות פריטים בין פלוגות או לבדוק פערים במלאי.",
    type: 'ERROR'
  };
};
