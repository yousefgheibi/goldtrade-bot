import fs from "fs";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import { bot } from "./bot.js";
import { DATA_DIR, EXPORT_DIR, USERS_FILE } from "../config.js";

export function exportExcel(chatId){
  const userFile = `${DATA_DIR}/data_${chatId}.json`;
  if(!fs.existsSync(userFile)) return bot.sendMessage(chatId,"❗ هنوز تراکنشی ثبت نکرده‌اید.");

  const transactions = JSON.parse(fs.readFileSync(userFile));
  if(!transactions.length) return bot.sendMessage(chatId,"❗ داده‌ای برای خروجی وجود ندارد.");

  const formattedData = transactions.map(t=>({
    "نوع تراکنش": t.type==="buy"?"خرید":"فروش",
    "نوع کالا": t.itemType,
    "نام خریدار/فروشنده": t.name,
    جزئیات: t.itemType==="طلا"?`نام: ${t.name}`:t.itemType==="سکه"?`نام: ${t.name}, نوع سکه: ${t.coinType}`:`نام: ${t.name}, نوع ارز: ${t.currencyType}`,
    "قیمت پایه / مثقال": (t.priceMithqal || t.basePrice)?.toLocaleString("fa-IR"),
    "تعداد / وزن": (t.quantity || t.weight)?.toLocaleString("fa-IR"),
    "مبلغ کل (تومان)": t.amount.toLocaleString("fa-IR"),
    توضیحات: t.desc,
    تاریخ: t.date
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,worksheet,"تراکنش‌ها");

  const filePath = `${EXPORT_DIR}/transactions_${chatId}_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook,filePath);
  bot.sendDocument(chatId,filePath);
}
