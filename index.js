import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Parser } from "json2csv";
import 'dotenv/config';


const token = process.env.TELEGRAM_TOKEN;

// ایجاد ربات با Polling
const bot = new TelegramBot(token, { polling: true });

// مسیر فایل ذخیره‌سازی داده‌ها
const dataFile = "./transactions.json";
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");

// مسیر پوشه خروجی
const exportDir = "./exports";
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

// حالت‌ها
const userState = {};

// 🏁 شروع کار با ربات
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendMainMenu(chatId);
});

// 📋 منوی اصلی
function sendMainMenu(chatId) {
  bot.sendMessage(chatId, "📊 لطفاً یکی از گزینه‌های زیر را انتخاب کنید:", {
    reply_markup: {
      keyboard: [
        ["🟢 ثبت خرید", "🔴 ثبت فروش"],
        ["📈 خلاصه وضعیت", "📤 خروجی CSV"],
      ],
      resize_keyboard: true,
    },
  });
}

// 🎯 پردازش انتخاب کاربر
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // نادیده گرفتن پیام‌ها در حین ورود داده
  if (userState[chatId]?.step) {
    handleTransactionInput(chatId, text);
    return;
  }

  switch (text) {
    case "🟢 ثبت خرید":
      startTransaction(chatId, "buy");
      break;
    case "🔴 ثبت فروش":
      startTransaction(chatId, "sell");
      break;
    case "📈 خلاصه وضعیت":
      showSummary(chatId);
      break;
    case "📤 خروجی CSV":
      exportCSV(chatId);
      break;
    default:
      sendMainMenu(chatId);
  }
});

// ✍️ شروع ثبت خرید/فروش
function startTransaction(chatId, type) {
  userState[chatId] = { type, step: "name" };
  const label = type === "buy" ? "خریدار" : "فروشنده";
  bot.sendMessage(chatId, `👤 نام ${label} را وارد کنید:`);
}

// 🔄 دریافت اطلاعات مرحله به مرحله
function handleTransactionInput(chatId, text) {
  const state = userState[chatId];

  switch (state.step) {
    case "name":
      state.name = text;
      state.step = "price";
      bot.sendMessage(chatId, "💰 قیمت طلا / سکه / مثقال را وارد کنید:");
      break;
    case "price":
      if (isNaN(text))
        return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
      state.price = parseFloat(text);
      state.step = "weight";
      bot.sendMessage(chatId, "⚖️ مقدار گرم را وارد کنید:");
      break;
    case "weight":
      if (isNaN(text))
        return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
      state.weight = parseFloat(text);
      state.step = "desc";
      bot.sendMessage(chatId, "📝 توضیحات (اختیاری):");
      break;
    case "desc":
      state.desc = text || "-";
      saveTransaction(chatId, state);
      break;
  }
}

// 💾 ذخیره تراکنش در فایل
function saveTransaction(chatId, state) {
  const transactions = JSON.parse(fs.readFileSync(dataFile));
  const record = {
    type: state.type,
    name: state.name,
    price: state.price,
    weight: state.weight,
    desc: state.desc,
    total: state.price * state.weight,
    date: new Date().toLocaleString("fa-IR"),
  };

  transactions.push(record);
  fs.writeFileSync(dataFile, JSON.stringify(transactions, null, 2));

  bot.sendMessage(
    chatId,
    `✅ تراکنش ${
      state.type === "buy" ? "خرید" : "فروش"
    } با موفقیت ثبت شد.\n💰 مبلغ کل: ${record.total.toLocaleString()}`
  );

  delete userState[chatId];
  sendMainMenu(chatId);
}

// 📈 خلاصه وضعیت
function showSummary(chatId) {
  const transactions = JSON.parse(fs.readFileSync(dataFile));

  const totalBuy = transactions
    .filter((t) => t.type === "buy")
    .reduce((sum, t) => sum + t.total, 0);

  const totalSell = transactions
    .filter((t) => t.type === "sell")
    .reduce((sum, t) => sum + t.total, 0);

  const profit = totalSell - totalBuy;

  const message = `
📊 خلاصه وضعیت:
-------------------------
🟢 مجموع خرید: ${totalBuy.toLocaleString()} تومان
🔴 مجموع فروش: ${totalSell.toLocaleString()} تومان
💎 سود / زیان خالص: ${profit.toLocaleString()} تومان
-------------------------
📅 تراکنش‌ها: ${transactions.length} عدد
`;

  bot.sendMessage(chatId, message);
}

// 📤 خروجی CSV و ارسال به کاربر
function exportCSV(chatId) {
  const transactions = JSON.parse(fs.readFileSync(dataFile));

  if (!transactions.length) {
    bot.sendMessage(chatId, "❗ داده‌ای برای خروجی وجود ندارد.");
    return;
  }

  const parser = new Parser();
  const csv = parser.parse(transactions);

  const filePath = `${exportDir}/transactions_${Date.now()}.csv`;
  fs.writeFileSync(filePath, csv, "utf8");

  bot
    .sendDocument(chatId, filePath, {
      caption: "📄 فایل خروجی تراکنش‌ها (CSV)",
    })
    .then(() => console.log("✅ CSV sent to user"))
    .catch((err) => {
      console.error("❌ Error sending CSV:", err);
      bot.sendMessage(chatId, "⚠️ خطایی در ارسال فایل رخ داد.");
    });
}
