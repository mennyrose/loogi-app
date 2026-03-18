/**
 * AI Service for Logi-6609 (Gemini Cloud Powered)
 * Uses Google Gemini API to handle natural language queries with system context.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Main AI Process Function using Gemini
 */
export const processQuery = async (query, context, apiKey) => {
  if (!apiKey) {
    return {
      text: "עוד לא הגדרת מפתח API שגוגל. אנא פתח מפתח ב-AI Studio והרזן אותו בניהול מערכת.",
      type: 'ERROR'
    };
  }

  const { catalog, inventory, requests, transactions } = context;

  // Prepare System Context (RAG)
  const systemPrompt = `
    אתה עוזר לוגיסטי חכם בשם LogiBot עבור גדוד 6609. המטרה שלך היא לעזור לקל"ג (קצין לוגיסטיקה) לנהל את המלאי והדרישות.
    
    נתוני המערכת הנוכחיים:
    קטלוג: ${JSON.stringify(catalog.map(i => ({ שם: i.name, מקט: i.sku, קטגוריה: i.category })))}
    מלאי גדודי: ${JSON.stringify(inventory.battalion)}
    דרישות פתוחות: ${JSON.stringify(requests.filter(r => r.status !== 'ISSUED'))}
    
    הוראות:
    1. ענה בעברית צבאית ומכובדת.
    2. אם שואלים על מלאי או חוסרים, נתח את הנתונים לעיל.
    3. אם יש טבלה של נתונים, החזר אותם בפורמט JSON שמתחיל ב-[ ומסתיים ב-] בתוך התשובה שלך (כדי שאוכל להציג אותם כטבלה).
    4. אם זו שאלה כללית ("מי אתה?", "איך משתמשים?"), הסבר בפירוט על המערכת.
    5. היה תמציתי ומקצועי.

    השאלה של המשתמש: "${query}"
  `;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "משהו השתבש בתקשורת עם ה-AI.";

    // Try to extract JSON data if present for table view
    let extractedData = null;
    const jsonMatch = aiText.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[0]);
      } catch (e) { console.error("JSON Parse Error from AI:", e); }
    }

    return {
      text: aiText.replace(/\[\s*\{.*\}\s*\]/s, '').trim(),
      data: extractedData,
      type: 'GEMINI'
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      text: "שגיאת חיבור ל-AI. וודא שמפתח ה-API תקין ושיש חיבור לאינטרנט.",
      type: 'ERROR'
    };
  }
};

/**
 * Export to Excel (remains the same helper)
 */
export const exportToExcel = (data, fileName = 'LogiReport.xlsx') => {
  if (!window.XLSX) return console.error('SheetJS not loaded');
  
  const ws = window.XLSX.utils.json_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Data');
  window.XLSX.writeFile(wb, fileName);
};
