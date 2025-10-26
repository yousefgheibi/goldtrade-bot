import fs from "fs";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import { bot } from "./bot.js";
import { DATA_DIR, EXPORT_DIR, USERS_FILE } from "../config.js";
import { DateTime } from "luxon";

export function exportExcel(chatId) {
  const userFile = `${DATA_DIR}/data_${chatId}.json`;
  if (!fs.existsSync(userFile))
    return bot.sendMessage(chatId, "❗ هنوز تراکنشی ثبت نکرده‌اید.");

  const transactions = JSON.parse(fs.readFileSync(userFile));
  if (!transactions.length)
    return bot.sendMessage(chatId, "❗ داده‌ای برای خروجی وجود ندارد.");

 const formattedData = transactions.map((t) => {
    let persianDate = "-";
    try {
      const dt = DateTime.fromISO(t.date, { zone: "Asia/Tehran" });
      if (dt.isValid) {
        persianDate = dt.setLocale("fa").toFormat("yyyy/LL/dd - HH:mm");
      }
    } catch {
      persianDate = t.date;
    }

    let details = "-";
    if (t.itemType === "سکه") details = `نوع سکه: ${t.coinType}`;
    else if (t.itemType === "ارز") details = `نوع ارز: ${t.currencyType}`;
    else if (t.itemType === "طلا") details = "طلا";

    return {
      "نوع تراکنش": t.type === "buy" ? "خرید" : "فروش",
      "نوع کالا": t.itemType,
      "نام خریدار/فروشنده": t.name,
      "جزئیات": details,
      "قیمت پایه / مثقال": (t.priceMithqal || t.basePrice)?.toLocaleString("fa-IR"),
      "تعداد / وزن": (t.quantity || t.weight)?.toLocaleString("fa-IR"),
      "مبلغ کل (تومان)": t.amount.toLocaleString("fa-IR"),
      "توضیحات": t.desc || "-",
      "تاریخ": persianDate,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "تراکنش‌ها");

  const filePath = `${EXPORT_DIR}/transactions_${chatId}_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, filePath);
  bot.sendDocument(chatId, filePath);
}

export function exportUsers(chatId) {
  if (!fs.existsSync(USERS_FILE))
    return bot.sendMessage(chatId, "❗ هیچ کاربری ثبت نشده است.");

  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  if (!users.length)
    return bot.sendMessage(chatId, "❗ هیچ کاربری ثبت نشده است.");

  const formatted = users.map((u) => ({
    "نام": u.name,
    "شناسه چت": u.chatId,
    "وضعیت": u.status,
    "تاریخ ثبت": u.date,
    "تاریخ انقضا": u.approvedUntil
      ? new Date(u.approvedUntil).toLocaleDateString("fa-IR")
      : "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(formatted);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "کاربران");

  const excelPath = `./exports/users_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, excelPath);
  bot.sendDocument(chatId, excelPath);
}

export function exportAllData(chatId) {
  if (!fs.existsSync(DATA_DIR))
    return bot.sendMessage(chatId, "❗ هیچ داده‌ای برای بکاپ وجود ندارد.");

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("data_"));
  if (!files.length)
    return bot.sendMessage(chatId, "❗ هیچ داده‌ای برای بکاپ وجود ندارد.");

  let allData = [];
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(`${DATA_DIR}/${file}`));
    allData = allData.concat(content);
  }

  if (!allData.length)
    return bot.sendMessage(chatId, "❗ هیچ تراکنشی ثبت نشده است.");

  const worksheet = XLSX.utils.json_to_sheet(allData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "بکاپ");

  const excelPath = `./exports/backup_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, excelPath);

  const zip = new AdmZip();
  zip.addLocalFile(excelPath);
  zip.addLocalFile(USERS_FILE);
  zip.addLocalFolder(DATA_DIR, "data");
  const zipPath = `./exports/backup_full_${Date.now()}.zip`;
  zip.writeZip(zipPath);

  bot.sendDocument(chatId, zipPath);

  setTimeout(() => {
    fs.unlinkSync(excelPath);
    fs.unlinkSync(zipPath);
  }, 5000);
}
