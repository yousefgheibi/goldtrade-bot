import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import XLSX from "xlsx";
import { createCanvas, registerFont } from "canvas";
import dotenv from "dotenv";
import AdmZip from "adm-zip";

dotenv.config({ debug: false });

registerFont("./assets/font/vazirmatn.ttf", { family: "Vazirmatn" });
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const dataDir = "./data";
const exportDir = "./exports";
const usersFile = "./users.json";

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "[]", "utf8");

const ADMIN_CHAT_ID = 507528648;
const APPROVAL_DURATION_DAYS = 30;
const userState = {};

// 🟢 استارت بات
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "کاربر";
  registerUser(chatId, name);
  sendMainMenu(chatId);
});

// 🟠 ثبت کاربر جدید یا بررسی تایید
function registerUser(chatId, name) {
  const users = JSON.parse(fs.readFileSync(usersFile));
  let user = users.find((u) => u.chatId === chatId);

  if (!user) {
    user = {
      chatId,
      name,
      date: new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }),
      status: "pending",
      approvedUntil: null,
    };
    users.push(user);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    bot.sendMessage(
      ADMIN_CHAT_ID,
      `📢 کاربر جدید درخواست دسترسی داده:\n👤 ${name}\n🆔 ${chatId}\n\nبرای تأیید تا ۳۰ روز آینده دستور زیر را ارسال کن:\n/approve ${chatId}`
    );

    bot.sendMessage(
      chatId,
      "⏳ درخواست شما برای استفاده از ربات ثبت شد. لطفاً منتظر تأیید ادمین باشید."
    );
  } else {
    if (user.status === "approved") {
      sendMainMenu(chatId);
    } else if (user.status === "expired") {
      bot.sendMessage(
        chatId,
        "❌ مدت اعتبار شما منقضی شده است. لطفاً منتظر تأیید مجدد باشید."
      );
    } else {
      bot.sendMessage(chatId, "⏳ درخواست شما در انتظار تأیید ادمین است.");
    }
  }
}

// 🧾 منوی اصلی
function sendMainMenu(chatId) {
  if (chatId === ADMIN_CHAT_ID) {
    bot.sendMessage(chatId, "🛠 منوی ادمین:", {
      reply_markup: {
        keyboard: [["📤 خروجی کاربران", "💾 بکاپ کل داده‌ها"]],
        resize_keyboard: true,
      },
    });
  } else {
    bot.sendMessage(chatId, "📊 لطفاً یکی از گزینه‌ها را انتخاب کنید:", {
      reply_markup: {
        keyboard: [
          ["🟢 ثبت خرید", "🔴 ثبت فروش"],
          ["📈 خلاصه وضعیت", "📤 خروجی فایل"],
        ],
        resize_keyboard: true,
      },
    });
  }
}

// 🎯 بررسی وضعیت کاربر قبل از هر پیام
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (text === "/start" || text.startsWith("/approve")) return;

  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find((u) => u.chatId === chatId);

  if (!user)
    return bot.sendMessage(chatId, "⚠️ لطفاً ابتدا دستور /start را ارسال کنید.");

  if (user.status === "pending")
    return bot.sendMessage(chatId, "⏳ درخواست شما در انتظار تأیید ادمین است.");

  if (
    user.status === "expired" ||
    (user.approvedUntil && new Date() > new Date(user.approvedUntil))
  ) {
    user.status = "expired";
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    return bot.sendMessage(
      chatId,
      "❌ مدت اعتبار شما به پایان رسیده است. لطفاً منتظر تأیید مجدد باشید."
    );
  }

  // 🛠 منوی مخصوص ادمین
  if (chatId === ADMIN_CHAT_ID) {
    if (text === "📤 خروجی کاربران") return exportUsers(chatId);
    if (text === "💾 بکاپ کل داده‌ها") return exportAllData(chatId);
  }

  if (userState[chatId]?.step) {
    handleInput(chatId, text);
    return;
  }

  switch (text) {
    case "🟢 ثبت خرید":
      userState[chatId] = { type: "buy", step: "name" };
      bot.sendMessage(chatId, "👤 لطفاً نام خریدار را وارد کنید:");
      break;
    case "🔴 ثبت فروش":
      userState[chatId] = { type: "sell", step: "name" };
      bot.sendMessage(chatId, "👤 لطفاً نام فروشنده را وارد کنید:");
      break;
    case "📈 خلاصه وضعیت":
      showSummary(chatId);
      break;
    case "📤 خروجی فایل":
      exportExcel(chatId);
      break;
    default:
      sendMainMenu(chatId);
  }
});

// 🧩 تابع ثبت تراکنش
function handleInput(chatId, text) {
  const state = userState[chatId];

  switch (state.step) {
    case "name":
      state.name = text;
      state.step = "itemType";
      bot.sendMessage(chatId, "🏷 لطفاً نوع کالا را انتخاب کنید:", {
        reply_markup: {
          keyboard: [["طلا", "سکه", "ارز"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      break;

    case "itemType":
      if (!["طلا", "سکه", "ارز"].includes(text))
        return bot.sendMessage(chatId, "❌ لطفاً یکی از گزینه‌ها را انتخاب کنید.");
      state.itemType = text;

      if (text === "طلا") {
        state.step = "priceMithqal";
        bot.sendMessage(chatId, "💰 لطفاً قیمت روز مثقال طلا را وارد کنید:");
      } else if (text === "سکه") {
        state.step = "coinType";
        bot.sendMessage(chatId, "🪙 لطفاً نوع سکه را انتخاب کنید:", {
          reply_markup: {
            keyboard: [["ربع", "نیم", "تمام"]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      } else if (text === "ارز") {
        state.step = "currencyType";
        bot.sendMessage(chatId, "💵 لطفاً نوع ارز را انتخاب کنید:", {
          reply_markup: {
            keyboard: [["دلار", "یورو", "لیر"]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      }
      break;

    case "priceMithqal":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ فقط عدد وارد کنید.");
      state.priceMithqal = Number(text);
      state.step = "amount";
      bot.sendMessage(chatId, "💵 مبلغ کل خرید یا فروش را وارد کنید:");
      break;

    case "amount":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ فقط عدد وارد کنید.");
      state.amount = Number(text);
      if (state.itemType === "طلا") {
        state.weight = parseFloat(
          ((state.amount / state.priceMithqal) * 4.3318).toFixed(3)
        );
        state.step = "desc";
        bot.sendMessage(chatId, "📝 توضیحات (اختیاری) را وارد کنید:");
      } else {
        state.step = "quantity";
        bot.sendMessage(chatId, "🔢 لطفاً تعداد را وارد کنید:");
      }
      break;

    case "coinType":
      state.coinType = text;
      state.step = "basePrice";
      bot.sendMessage(chatId, "💰 قیمت پایه را وارد کنید:");
      break;

    case "currencyType":
      state.currencyType = text;
      state.step = "basePrice";
      bot.sendMessage(chatId, "💰 قیمت پایه را وارد کنید:");
      break;

    case "basePrice":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ فقط عدد وارد کنید.");
      state.basePrice = Number(text);
      state.step = "quantity";
      bot.sendMessage(chatId, "🔢 لطفاً تعداد را وارد کنید:");
      break;

    case "quantity":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ فقط عدد وارد کنید.");
      state.quantity = Number(text);
      state.amount = state.basePrice * state.quantity;
      state.step = "desc";
      bot.sendMessage(chatId, "📝 توضیحات (اختیاری) را وارد کنید:");
      break;

    case "desc":
      state.desc = text || "-";
      saveTransaction(chatId, state);
      delete userState[chatId];
      break;
  }
}

// 💾 ذخیره تراکنش
function saveTransaction(chatId, record) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  let transactions = [];
  if (fs.existsSync(userFile))
    transactions = JSON.parse(fs.readFileSync(userFile));

  const entry = {
    ...record,
    date: new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }),
  };
  transactions.push(entry);
  fs.writeFileSync(userFile, JSON.stringify(transactions, null, 2));

  const filePath = `${exportDir}/invoice_${chatId}_${Date.now()}.png`;
  createInvoiceImage(entry, filePath, () => {
    bot.sendPhoto(chatId, filePath, {
      caption: `✅ تراکنش ${entry.type === "buy" ? "خرید" : "فروش"} ثبت شد.`,
    });
  });

  setTimeout(() => sendMainMenu(chatId), 1000);
}

// 📄 ساخت تصویر فاکتور
function createInvoiceImage(entry, outputPath, callback) {
  const width = 600;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fffcf8";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 32px Vazirmatn";
  ctx.fillText("گالری یامـــور", 200, 80);
  ctx.textAlign = "right";

  const startX = width - 40;
  let startY = 120;
  const lineHeight = 40;

  ctx.fillStyle = "#333";
  ctx.font = "20px Vazirmatn";
  ctx.fillText(`تاریخ: ${entry.date}`, startX, startY);
  startY += lineHeight;
  ctx.fillText(
    `نوع تراکنش: ${entry.type === "buy" ? "خرید" : "فروش"}`,
    startX,
    startY
  );
  startY += lineHeight;
  ctx.fillText(`نام: ${entry.name}`, startX, startY);
  startY += lineHeight;
  ctx.fillText(`نوع کالا: ${entry.itemType}`, startX, startY);
  startY += lineHeight;

  if (entry.itemType === "طلا") {
    ctx.fillText(
      `قیمت مثقال: ${entry.priceMithqal.toLocaleString("fa-IR")} تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(
      `مبلغ کل: ${entry.amount.toLocaleString("fa-IR")} تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(`وزن: ${entry.weight.toLocaleString("fa-IR")} گرم`, startX, startY);
  } else if (entry.itemType === "سکه") {
    ctx.fillText(`نوع سکه: ${entry.coinType}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(
      `قیمت پایه: ${entry.basePrice.toLocaleString("fa-IR")} تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(`تعداد: ${entry.quantity}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(`مبلغ کل: ${entry.amount.toLocaleString("fa-IR")} تومان`, startX, startY);
  } else if (entry.itemType === "ارز") {
    ctx.fillText(`نوع ارز: ${entry.currencyType}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(
      `قیمت پایه: ${entry.basePrice.toLocaleString("fa-IR")} تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(`تعداد: ${entry.quantity}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(`مبلغ کل: ${entry.amount.toLocaleString("fa-IR")} تومان`, startX, startY);
  }

  startY += lineHeight;
  ctx.fillText(`توضیحات: ${entry.desc}`, startX, startY);

  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
  callback();
}

// 📈 خلاصه وضعیت
function showSummary(chatId) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  if (!fs.existsSync(userFile))
    return bot.sendMessage(chatId, "❗ هنوز تراکنشی ثبت نکرده‌اید.");

  const transactions = JSON.parse(fs.readFileSync(userFile));
  if (!transactions.length)
    return bot.sendMessage(chatId, "❗ داده‌ای برای نمایش وجود ندارد.");

  const totalBuy = transactions
    .filter((t) => t.type === "buy")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSell = transactions
    .filter((t) => t.type === "sell")
    .reduce((sum, t) => sum + t.amount, 0);

  const msg = `
📊 خلاصه وضعیت:
-------------------------
🟢 مجموع خرید: ${totalBuy.toLocaleString("fa-IR")} تومان
🔴 مجموع فروش: ${totalSell.toLocaleString("fa-IR")} تومان
-------------------------
📅 تعداد تراکنش‌ها: ${transactions.length}
`;
  bot.sendMessage(chatId, msg);
}

// 📤 خروجی اکسل کاربر
function exportExcel(chatId) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  if (!fs.existsSync(userFile))
    return bot.sendMessage(chatId, "❗ هنوز تراکنشی ثبت نکرده‌اید.");

  const transactions = JSON.parse(fs.readFileSync(userFile));
  if (!transactions.length)
    return bot.sendMessage(chatId, "❗ داده‌ای برای خروجی وجود ندارد.");

  const formattedData = transactions.map((t) => ({
    "نوع تراکنش": t.type === "buy" ? "خرید" : "فروش",
    "نوع کالا": t.itemType,
    "نام خریدار/فروشنده": t.name,
    جزئیات:
      t.itemType === "طلا"
        ? `نام: ${t.name}`
        : t.itemType === "سکه"
        ? `نام: ${t.name}, نوع سکه: ${t.coinType}`
        : `نام: ${t.name}, نوع ارز: ${t.currencyType}`,
    "قیمت پایه / مثقال": (t.priceMithqal || t.basePrice)?.toLocaleString("fa-IR"),
    "تعداد / وزن": (t.quantity || t.weight)?.toLocaleString("fa-IR"),
    "مبلغ کل (تومان)": t.amount.toLocaleString("fa-IR"),
    توضیحات: t.desc,
    تاریخ: t.date,
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "تراکنش‌ها");

  const filePath = `${exportDir}/transactions_${chatId}_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, filePath);
  bot.sendDocument(chatId, filePath);
}

// 📤 خروجی کاربران (ادمین)
function exportUsers(chatId) {
  const users = JSON.parse(fs.readFileSync(usersFile));
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

  const excelPath = `${exportDir}/users_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, excelPath);

  const zip = new AdmZip();
  zip.addLocalFile(excelPath);
  const zipPath = `${exportDir}/users_export_${Date.now()}.zip`;
  zip.writeZip(zipPath);

  bot.sendDocument(chatId, zipPath);

  setTimeout(() => {
    fs.unlinkSync(excelPath);
    fs.unlinkSync(zipPath);
  }, 5000);
}

// 💾 بکاپ کل داده‌ها (ادمین)
function exportAllData(chatId) {
  const files = fs.readdirSync(dataDir).filter((f) => f.startsWith("data_"));
  if (!files.length)
    return bot.sendMessage(chatId, "❗ هیچ داده‌ای برای بکاپ وجود ندارد.");

  let allData = [];
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(`${dataDir}/${file}`));
    allData = allData.concat(content);
  }

  if (!allData.length)
    return bot.sendMessage(chatId, "❗ هیچ تراکنشی ثبت نشده است.");

  const worksheet = XLSX.utils.json_to_sheet(allData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "بکاپ");

  const excelPath = `${exportDir}/backup_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, excelPath);

  const zip = new AdmZip();
  zip.addLocalFile(excelPath);
  zip.addLocalFile(usersFile);
  zip.addLocalFolder(dataDir, "data");
  const zipPath = `${exportDir}/backup_full_${Date.now()}.zip`;
  zip.writeZip(zipPath);

  bot.sendDocument(chatId, zipPath);

  setTimeout(() => {
    fs.unlinkSync(excelPath);
    fs.unlinkSync(zipPath);
  }, 5000);
}

bot.onText(/\/approve (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== ADMIN_CHAT_ID)
    return bot.sendMessage(chatId, "⛔ شما دسترسی ادمین ندارید.");

  const targetChatId = parseInt(match[1]);
  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find((u) => u.chatId === targetChatId);

  if (!user) return bot.sendMessage(chatId, "❗ کاربر یافت نشد.");

  user.status = "approved";
  user.approvedUntil = new Date(
    Date.now() + APPROVAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  );
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  bot.sendMessage(chatId, `✅ کاربر ${user.name} تأیید شد.`);
  bot.sendMessage(
    targetChatId,
    "✅ دسترسی شما تا ۳۰ روز آینده فعال شد. حالا می‌توانید از ربات استفاده کنید."
  );
});
