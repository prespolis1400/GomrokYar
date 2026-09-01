import fs from 'fs/promises';

async function fetchAndParseRates() {
  const jsonUrl = 'https://gomrok24.com/customer/page/customs-exchange-rate';

  try {
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'fa-IR,fa;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`خطا در دریافت JSON: ${response.status}`);
    }

    const data = await response.json();

    // ۱. تابع بازگشتی برای پیدا کردن فیلد "text" حاوی "tariff-table"
    function findHtmlText(obj) {
      if (typeof obj === 'string') {
        if (obj.includes('tariff-table')) return obj;
        return null;
      }

      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (key === 'text' && typeof obj[key] === 'string' && obj[key].includes('tariff-table')) {
            return obj[key];
          }
          const result = findHtmlText(obj[key]);
          if (result) return result;
        }
      }
      return null;
    }

    const htmlString = findHtmlText(data);
    if (!htmlString) {
      throw new Error('رشته HTML حاوی جدول tariff-table در JSON پیدا نشد.');
    }

    // ۲. استخراج جدول
    const tableRegex = /<table[^>]*class="[^"]*tariff-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
    const tableMatch = htmlString.match(tableRegex);
    if (!tableMatch) {
      throw new Error('جدول با کلاس tariff-table در HTML پیدا نشد.');
    }

    const tableContent = tableMatch[1];

    // ۳. استخراج ردیف‌های جدول
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isHeaderSkipped = false;
    const rates = [];

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowHtml = rowMatch[1];

      if (!isHeaderSkipped && /<th/i.test(rowHtml)) {
        isHeaderSkipped = true;
        continue;
      }

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        let text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
        cells.push(text);
      }

      if (cells.length >= 3) {
        const code = cells[0];
        const currency = cells[1];
        const rateStr = cells[2].replace(/,/g, '');
        const rate = parseFloat(rateStr);
        if (code && currency && !isNaN(rate)) {
          rates.push({ code, currency, rate });
        }
      }
    }

    if (rates.length === 0) {
      throw new Error('هیچ داده‌ای در جدول یافت نشد.');
    }

    const finalOutput = {
      success: true,
      data: rates,
      count: rates.length,
      updated_at: new Date().toISOString(),
      message: 'نرخ ارز گمرک'
    };

    // ذخیره در فایل خروجی
    await fs.writeFile('rates.json', JSON.stringify(finalOutput, null, 2), 'utf-8');
    console.log('فایل rates.json با موفقیت به‌روزرسانی شد.');

  } catch (error) {
    console.error('عملیات ناموفق:', error.message);
    process.exit(1);
  }
}

fetchAndParseRates();
