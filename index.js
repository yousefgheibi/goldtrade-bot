import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Parser } from "json2csv";
// import 'dotenv/config';

const token = "8240277790:AAGIj4t7pp_FfAWYLf3LAhD76SCAEmlIzjs";

// ایجاد ربات با Polling
const bot = new TelegramBot(token, { polling: true });

// مسیر پوشه داده‌ها و خروجی‌ها
const dataDir = "./data";
const exportDir = "./exports";

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

// حالت‌ها برای ورود مرحله‌ای کاربر
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

// 🎯 پردازش پیام کاربر
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // اگر کاربر در حال وارد کردن تراکنش است
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

// ✍️ شروع تراکنش
function startTransaction(chatId, type) {
  userState[chatId] = { type, step: "name" };
  const label = type === "buy" ? "خریدار" : "فروشنده";
  bot.sendMessage(chatId, `👤 نام ${label} را وارد کنید:`);
}

// 🔄 دریافت اطلاعات مرحله‌ای
function handleTransactionInput(chatId, text) {
  const state = userState[chatId];

  switch (state.step) {
    case "name":
      state.name = text;
      state.step = "typeItem";
      bot.sendMessage(chatId, "💎 نوع کالا را وارد کنید:\nطلا / سکه / آبشده");
      break;

    case "typeItem":
      const validTypes = ["طلا", "سکه", "آبشده"];
      if (!validTypes.includes(text))
        return bot.sendMessage(chatId, "❌ لطفاً یکی از گزینه‌ها را وارد کنید: طلا / سکه / آبشده");
      state.typeItem = text;
      state.step = "priceDay";
      bot.sendMessage(chatId, "💰 قیمت روز مثقال طلا را وارد کنید (تومان):");
      break;

    case "priceDay":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
      state.priceDay = parseFloat(text);
      state.step = "price";
      bot.sendMessage(chatId, "💰 مبلغ کل را وارد کنید (تومان):");
      break;

    case "price":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
      state.price = parseFloat(text);
      state.step = "weight";
      bot.sendMessage(chatId, "⚖️ مقدار (گرم یا تعداد) را وارد کنید:");
      break;

    case "weight":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
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

// 💾 ذخیره تراکنش در فایل جداگانه هر کاربر
function saveTransaction(chatId, state) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  let transactions = [];
  if (fs.existsSync(userFile)) {
    transactions = JSON.parse(fs.readFileSync(userFile));
  }

  const record = {
    type: state.type,          // خرید یا فروش
    name: state.name,          // نام خریدار/فروشنده
    typeItem: state.typeItem,  // نوع کالا
    priceDay: state.priceDay,  // قیمت روز مثقال طلا
    price: state.price,        // مبلغ کل
    weight: state.weight,      // مقدار
    desc: state.desc,          // توضیحات
    date: new Date().toLocaleString("fa-IR"),
  };

  transactions.push(record);
  fs.writeFileSync(userFile, JSON.stringify(transactions, null, 2));

  // فقط پیام موفقیت
  bot.sendMessage(
    chatId,
    `✅ تراکنش ${state.type === "buy" ? "خرید" : "فروش"} ثبت شد.\n💰 مبلغ: ${record.price.toLocaleString("fa-IR")} تومان`
  );

  delete userState[chatId];
}

// 📈 نمایش خلاصه وضعیت همان کاربر
function showSummary(chatId) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  if (!fs.existsSync(userFile)) {
    return bot.sendMessage(chatId, "❗ هنوز تراکنشی ثبت نکرده‌اید.");
  }

  const transactions = JSON.parse(fs.readFileSync(userFile));

  const totalBuy = transactions
    .filter((t) => t.type === "buy")
    .reduce((sum, t) => sum + t.price, 0);

  const totalSell = transactions
    .filter((t) => t.type === "sell")
    .reduce((sum, t) => sum + t.price, 0);

  const profit = totalSell - totalBuy;

  const message = `
📊 خلاصه وضعیت:
-------------------------
🟢 مجموع خرید: ${totalBuy.toLocaleString("fa-IR")} تومان
🔴 مجموع فروش: ${totalSell.toLocaleString("fa-IR")} تومان
💎 سود / زیان خالص: ${profit.toLocaleString("fa-IR")} تومان
-------------------------
📅 تعداد تراکنش‌ها: ${transactions.length}
`;
  bot.sendMessage(chatId, message);
}

// 📤 خروجی CSV برای همان کاربر
function exportCSV(chatId) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  if (!fs.existsSync(userFile)) {
    return bot.sendMessage(chatId, "❗ هنوز تراکنشی ثبت نکرده‌اید.");
  }

  const transactions = JSON.parse(fs.readFileSync(userFile));
  if (!transactions.length) {
    return bot.sendMessage(chatId, "❗ داده‌ای برای خروجی وجود ندارد.");
  }

  const parser = new Parser({
    fields: ['type', 'name', 'typeItem', 'priceDay', 'price', 'weight', 'desc', 'date'],
    transforms: [
      (item) => ({
        ...item,
        priceDay: `${item.priceDay.toLocaleString("fa-IR")} تومان`,
        price: `${item.price.toLocaleString("fa-IR")} تومان`
      })
    ]
  });

  const csv = parser.parse(transactions);

  const filePath = `${exportDir}/transactions_${chatId}_${Date.now()}.csv`;
  fs.writeFileSync(filePath, csv, "utf8");

  bot.sendDocument(chatId, filePath, {
    caption: "📄 فایل خروجی تراکنش‌ها (CSV)",
  })
    .then(() => console.log("✅ CSV sent to user", chatId))
    .catch((err) => {
      console.error("❌ Error sending CSV:", err);
      bot.sendMessage(chatId, "⚠️ خطایی در ارسال فایل رخ داد.");
    });
}
