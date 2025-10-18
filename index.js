import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Parser } from "json2csv";
import dotenv from "dotenv";
dotenv.config();


const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: false });

bot.deleteWebHook().then(() => {
  console.log("✅ Webhook deleted. Starting polling...");
  bot.startPolling();
});

const dataDir = "./data";
const exportDir = "./exports";
const usersFile = "./users.json";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "[]", "utf8");

const ADMIN_CHAT_ID = 507528648;
const userState = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "کاربر";
  registerUser(chatId, name);
  
  sendMainMenu(chatId);
});

function registerUser(chatId, name) {
  const users = JSON.parse(fs.readFileSync(usersFile));
  const exists = users.find((u) => u.chatId === chatId);
  if (!exists) {
    users.push({ chatId, name, date: new Date().toLocaleString("fa-IR") });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    bot.sendMessage(
      ADMIN_CHAT_ID,
      `📢 کاربر جدید ثبت شد!\n👤 نام: ${name}\n🆔 Chat ID: ${chatId}`
    );
  }
}

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

  if (text === "/start") return; // جلوگیری از دوباره اجرا شدن

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
      bot.sendMessage(chatId, "💰 قیمت (به تومان) را وارد کنید:");
      break;
    case "price":
      if (isNaN(text))
        return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
      state.price = Number(text);
      state.step = "weight";
      bot.sendMessage(chatId, "⚖️ مقدار (گرم) را وارد کنید:");
      break;
    case "weight":
      if (isNaN(text))
        return bot.sendMessage(chatId, "❌ لطفاً عدد وارد کنید.");
      state.weight = Number(text);
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
    type: state.type,
    name: state.name,
    price: Number(state.price),
    weight: Number(state.weight),
    desc: state.desc,
    date: new Date().toLocaleString("fa-IR"),
  };

  transactions.push(record);
  fs.writeFileSync(userFile, JSON.stringify(transactions, null, 2));

  bot.sendMessage(
    chatId,
    `✅ تراکنش ${
      state.type === "buy" ? "خرید" : "فروش"
    } ثبت شد.\n💰 مبلغ: ${record.price.toLocaleString("fa-IR")} تومان`
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
    .reduce((sum, t) => sum + Number(t.price || 0), 0);

  const totalSell = transactions
    .filter((t) => t.type === "sell")
    .reduce((sum, t) => sum + Number(t.price || 0), 0);

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

  const csv = new Parser({
    fields: ["type", "name", "price", "weight", "desc", "date"],
  }).parse(
    transactions.map((t) => ({
      ...t,
      price: `${Number(t.price).toLocaleString("fa-IR")} تومان`,
      weight: `${Number(t.weight).toLocaleString("fa-IR")} گرم`,
    }))
  );

  const filePath = `${exportDir}/transactions_${chatId}_${Date.now()}.csv`;
  fs.writeFileSync(filePath, csv, "utf8");

  bot
    .sendDocument(chatId, filePath, {
      caption: "📄 فایل خروجی تراکنش‌ها (CSV)",
    })
    .catch((err) => {
      console.error("❌ Error sending CSV:", err);
      bot.sendMessage(chatId, "⚠️ خطایی در ارسال فایل رخ داد.");
    });
}
