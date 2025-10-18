import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Parser } from "json2csv";

const token = "8240277790:AAGue1wI4tQcrevrlzHvMLyg4madEsbZq70";
const bot = new TelegramBot(token, { polling: true });

// حذف webhook قبل از شروع polling
bot.deleteWebHook().then(() => {
  console.log("✅ Webhook deleted. Starting polling...");
  bot.startPolling();
});

const dataFile = "./transactions.json";
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

const dataDir = "./data";
const exportDir = "./exports";


const userState = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendMainMenu(chatId);
});

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

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

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

function startTransaction(chatId, type) {
  userState[chatId] = { type, step: "name" };
  const label = type === "buy" ? "خریدار" : "فروشنده";
  bot.sendMessage(chatId, `👤 نام ${label} را وارد کنید:`);
}

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

function saveTransaction(chatId, state) {
  const userFile = `${dataDir}/data_${chatId}.json`;
  let transactions = [];
  if (fs.existsSync(userFile)) {
    transactions = JSON.parse(fs.readFileSync(userFile));
  }

  const record = {
    type: state.type,          // خرید یا فروش
    name: state.name,          // نام خریدار/فروشنده
    price: state.price,        // مبلغ کل
    weight: state.weight,      // مقدار
    desc: state.desc,          // توضیحات
    date: new Date().toLocaleString("fa-IR"),
  };

  transactions.push(record);
  fs.writeFileSync(userFile, JSON.stringify(transactions, null, 2));

  bot.sendMessage(
    chatId,
    `✅ تراکنش ${state.type === "buy" ? "خرید" : "فروش"} ثبت شد.\n💰 مبلغ: ${record.price.toLocaleString("fa-IR")} تومان`
  );

  showSummary(chatId);
  delete userState[chatId];
}
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
    fields: ['type', 'name', 'price', 'weight', 'desc', 'date'],
    transforms: [
      (item) => ({
        ...item,
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