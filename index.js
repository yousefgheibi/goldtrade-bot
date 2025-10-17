import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Parser } from "json2csv";

const token = "8240277790:AAGIj4t7pp_FfAWYLf3LAhD76SCAEmlIzjs"; // توکن ربات تلگرام‌ات
const bot = new TelegramBot(token, { polling: true });

const dataFile = "./data/transactions.json";

// اگر فایل دیتا وجود نداشت، بسازش
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// متغیر برای نگه داشتن حالت کاربر (خرید یا فروش)
const userStates = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `سلام ${msg.from.first_name} 👋
من ربات حسابداری خرید و فروش طلا هستم.
دستورات زیر رو می‌تونی استفاده کنی:
/buy - ثبت خرید
/sell - ثبت فروش
/export - خروجی CSV`
  );
});

// شروع ثبت خرید
bot.onText(/\/buy/, (msg) => {
  userStates[msg.chat.id] = { type: "buy", step: 1, data: {} };
  bot.sendMessage(msg.chat.id, "نام فروشنده را وارد کنید:");
});

// شروع ثبت فروش
bot.onText(/\/sell/, (msg) => {
  userStates[msg.chat.id] = { type: "sell", step: 1, data: {} };
  bot.sendMessage(msg.chat.id, "نام خریدار را وارد کنید:");
});

bot.onText(/\/export/, (msg) => {
  const transactions = JSON.parse(fs.readFileSync(dataFile));
  if (!transactions.length) {
    bot.sendMessage(msg.chat.id, "هیچ تراکنشی برای خروجی وجود ندارد ❗");
    return;
  }

  const parser = new Parser();
  const csv = parser.parse(transactions);
  const exportPath = `./exports/transactions_${Date.now()}.csv`;
  fs.writeFileSync(exportPath, csv);

  bot.sendDocument(msg.chat.id, exportPath);
});

// هندل ورودی‌های کاربر
bot.on("message", (msg) => {
  const state = userStates[msg.chat.id];
  if (!state || msg.text.startsWith("/")) return;

  const data = state.data;

  switch (state.step) {
    case 1:
      data.name = msg.text;
      state.step++;
      bot.sendMessage(msg.chat.id, "قیمت طلا / سکه / مثقال را وارد کنید:");
      break;

    case 2:
      data.price = msg.text;
      state.step++;
      bot.sendMessage(msg.chat.id, "مقدار (به گرم) را وارد کنید:");
      break;

    case 3:
      data.amount = msg.text;
      state.step++;
      bot.sendMessage(msg.chat.id, "توضیحات را وارد کنید:");
      break;

    case 4:
      data.description = msg.text;
      data.date = new Date().toLocaleString("fa-IR");
      data.type = state.type;

      // ذخیره در فایل
      const transactions = JSON.parse(fs.readFileSync(dataFile));
      transactions.push(data);
      fs.writeFileSync(dataFile, JSON.stringify(transactions, null, 2));

      bot.sendMessage(
        msg.chat.id,
        `✅ ${state.type === "buy" ? "خرید" : "فروش"} ثبت شد.\n\n📜 جزئیات:\nنام: ${
          data.name
        }\nقیمت: ${data.price}\nمقدار: ${data.amount} گرم\nتوضیحات: ${
          data.description
        }\nتاریخ: ${data.date}`
      );

      delete userStates[msg.chat.id];
      break;
  }
});
