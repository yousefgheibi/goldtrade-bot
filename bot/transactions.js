import fs from "fs";
import { bot } from "./bot.js";
import { DATA_DIR, USERS_FILE } from "../config.js";
import { sendMainMenu } from "./menu.js";
import { createInvoiceImage } from "./invoice.js";
import { exportExcel, exportUsers, exportAllData } from "./exports.js";

export const userState = {};

export function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start" || text.startsWith("/approve")) return;

  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find((u) => u.chatId === chatId);

  if (!user)
    return bot.sendMessage(
      chatId,
      "⚠️ لطفاً ابتدا دستور /start را ارسال کنید."
    );

  if (user.status === "pending")
    return bot.sendMessage(chatId, "⏳ درخواست شما در انتظار تأیید ادمین است.");

  if (
    user.status === "expired" ||
    (user.approvedUntil && new Date() > new Date(user.approvedUntil))
  ) {
    user.status = "expired";
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return bot.sendMessage(
      chatId,
      "❌ مدت اعتبار شما به پایان رسیده است. لطفاً منتظر تأیید مجدد باشید."
    );
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
    case "💰 ثبت موجودی":
      userState[chatId] = { step: "setBalance" };
      bot.sendMessage(
        chatId,
        "💰 لطفاً موجودی خود را به این صورت وارد کنید:\n\nمثلاً:\nتومان=5000000\nدلار=200\nیورو=50\nلیر=0"
      );
      break;

    case "📈 خلاصه وضعیت":
      showSummary(chatId);
      break;
    case "📤 خروجی فایل":
      exportExcel(chatId);
      break;
    case "کاربران":
      exportUsers(chatId);
      break;
    case "بکاپ":
      exportAllData(chatId);
      break;
  }
}

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
        return bot.sendMessage(
          chatId,
          "❌ لطفاً یکی از گزینه‌ها را انتخاب کنید."
        );
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
      } else state.step = "quantity";
      bot.sendMessage(chatId, "🔢 لطفاً تعداد را وارد کنید:");
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
    case "setBalance":
      const balances = {};
      text.split("\n").forEach((line) => {
        const [currency, value] = line.split("=");
        if (currency && value)
          balances[currency.trim()] = parseFloat(value.trim());
      });
      const file = `${DATA_DIR}/balance_${chatId}.json`;
      fs.writeFileSync(file, JSON.stringify(balances, null, 2));
      bot.sendMessage(chatId, "✅ موجودی ثبت شد.");
      delete userState[chatId];
      break;
  }
}

function saveTransaction(chatId, record) {
  const userFile = `${DATA_DIR}/data_${chatId}.json`;
  let transactions = [];
  if (fs.existsSync(userFile))
    transactions = JSON.parse(fs.readFileSync(userFile));

  const entry = {
    ...record,
    date: new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }),
  };
  transactions.push(entry);
  fs.writeFileSync(userFile, JSON.stringify(transactions, null, 2));

  const filePath = `./exports/invoice_${chatId}_${Date.now()}.png`;
  createInvoiceImage(entry, filePath, () => {
    bot.sendPhoto(chatId, filePath, {
      caption: `✅ تراکنش ${entry.type === "buy" ? "خرید" : "فروش"} ثبت شد.`,
    });
  });

  setTimeout(() => sendMainMenu(chatId), 1000);
}

function showSummary(chatId) {
  // خواندن موجودی فعلی
  const balanceFile = `${DATA_DIR}/balance_${chatId}.json`;
  let balances = {};
  if (fs.existsSync(balanceFile)) {
    balances = JSON.parse(fs.readFileSync(balanceFile));
  }

  // محاسبه سود/زیان روزانه
  const today = new Date().toLocaleDateString("fa-IR");
  const todayTx = transactions.filter((t) => t.date.startsWith(today));
  const dailyBuy = todayTx
    .filter((t) => t.type === "buy")
    .reduce((s, t) => s + t.amount, 0);
  const dailySell = todayTx
    .filter((t) => t.type === "sell")
    .reduce((s, t) => s + t.amount, 0);
  const dailyProfit = dailySell - dailyBuy;

  // نمایش
  let balanceMsg = "\n💰 موجودی فعلی:\n";
  for (const [cur, val] of Object.entries(balances)) {
    balanceMsg += `• ${cur}: ${val.toLocaleString("fa-IR")}\n`;
  }

  const msg = `📊 خلاصه وضعیت:\n-------------------------\n🟢 مجموع خرید: ${totalBuy.toLocaleString(
    "fa-IR"
  )} تومان\n🔴 مجموع فروش: ${totalSell.toLocaleString(
    "fa-IR"
  )} تومان\n-------------------------\n📅 تعداد تراکنش‌ها: ${
    transactions.length
  }\n-------------------------\n📆 تراز امروز: ${dailyProfit.toLocaleString(
    "fa-IR"
  )} تومان${balanceMsg}`;
  bot.sendMessage(chatId, msg);
}
