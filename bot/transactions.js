import fs from "fs";
import { bot } from "./bot.js";
import { DATA_DIR, USERS_FILE } from "../config.js";
import { sendMainMenu } from "./menu.js";
import { createInvoiceImage } from "./invoice.js";
import { exportExcel, exportUsers, exportAllData } from "./exports.js";
import { DateTime } from "luxon";

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
      bot.sendMessage(chatId, "👤 لطفاً نام فرشنده را وارد کنید:");
      break;

    case "ثبت موجودی":
      const CURRENCIES = ["تومان", "دلار", "یورو", "لیر"];
      userState[chatId] = {
        step: "setBalance",
        currencies: CURRENCIES,
        index: 0,
        balances: {},
      };
      bot.sendMessage(
        chatId,
        `💰 مقدار ${CURRENCIES[0]} را وارد کنید.\n(فقط عدد — اگر صفر است یا می‌خواهید رد کنید، عدد 0 وارد کنید)\nبرای لغو، بنویسید: /cancel`
      );
      break;

    case "خلاصه وضعیت":
      showSummary(chatId);
      break;

    case "خروجی فایل":
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
      state.step = "quantity";
      bot.sendMessage(chatId, "🔢 لطفاً تعداد ارز را وارد کنید:");
      break;

    case "quantity":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ فقط عدد وارد کنید.");
      state.quantity = Number(text);

      if (state.itemType === "ارز") {
        state.step = "basePrice";
        bot.sendMessage(chatId, "💰 لطفاً قیمت پایه هر واحد ارز را وارد کنید:");
        return;
      }

      if (state.itemType === "سکه") {
        state.amount = state.basePrice * state.quantity;
        state.step = "desc";
        bot.sendMessage(chatId, "📝 توضیحات (اختیاری) را وارد کنید:");
      }
      break;

    case "basePrice":
      if (isNaN(text)) return bot.sendMessage(chatId, "❌ فقط عدد وارد کنید.");
      state.basePrice = Number(text);

      if (state.itemType === "ارز") {
        state.amount = state.basePrice * state.quantity;
        state.step = "desc";
        bot.sendMessage(chatId, "📝 توضیحات (اختیاری) را وارد کنید:");
      } else {
        state.step = "quantity";
        bot.sendMessage(chatId, "🔢 لطفاً تعداد را وارد کنید:");
      }
      break;

    case "desc":
      state.desc = text || "-";
      saveTransaction(chatId, state);
      delete userState[chatId];
      break;

    case "setBalance":
      if (text === "/cancel") {
        delete userState[chatId];
        bot.sendMessage(chatId, "❎ عملیات ثبت موجودی لغو شد.");
        return;
      }

      const curState = userState[chatId];
      const currencies = curState.currencies || [
        "تومان",
        "دلار",
        "یورو",
        "لیر",
      ];
      const idx = curState.index ?? 0;
      const currentCurrency = currencies[idx];

      const cleaned = text.replace(/,/g, "").trim();
      if (cleaned === "") {
        return bot.sendMessage(
          chatId,
          "❌ لطفاً یک عدد وارد کنید یا /cancel برای لغو."
        );
      }
      const num = Number(cleaned);
      if (isNaN(num)) {
        return bot.sendMessage(
          chatId,
          "❌ لطفاً فقط عدد وارد کنید. مثلاً: 5000000"
        );
      }

      curState.balances[currentCurrency] = num;
      curState.index = idx + 1;

      if (curState.index < currencies.length) {
        const nextCurrency = currencies[curState.index];
        bot.sendMessage(
          chatId,
          `💰 مقدار ${nextCurrency} را وارد کنید.\n(فقط عدد — اگر صفر است، 0 وارد کنید)\nبرای لغو، /cancel`
        );
      } else {
        const outFile = `${DATA_DIR}/balance_${chatId}.json`;
        try {
          fs.writeFileSync(outFile, JSON.stringify(curState.balances, null, 2));
          bot.sendMessage(
            chatId,
            "✅ موجودی‌ها با موفقیت ثبت شد:\n" +
              Object.entries(curState.balances)
                .map(([k, v]) => `• ${k}: ${v.toLocaleString("fa-IR")}`)
                .join("\n")
          );
        } catch (err) {
          console.error("write balance error:", err);
          bot.sendMessage(chatId, "⚠️ خطا در ذخیره موجودی. دوباره تلاش کنید.");
        }
        delete userState[chatId];
      }
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

  if (!fs.existsSync("./exports")) fs.mkdirSync("./exports");

  const filePath = `./exports/invoice_${chatId}_${Date.now()}.png`;
  createInvoiceImage(entry, filePath, () => {
    bot.sendPhoto(chatId, filePath, {
      caption: `✅ تراکنش ${entry.type === "buy" ? "خرید" : "فروش"} ثبت شد.`,
    });
  });

  setTimeout(() => sendMainMenu(chatId), 1000);
}

function showSummary(chatId) {
  const balanceFile = `${DATA_DIR}/balance_${chatId}.json`;
  const dataFile = `${DATA_DIR}/data_${chatId}.json`;

  let balances = {};
  let transactions = [];

  if (fs.existsSync(balanceFile))
    balances = JSON.parse(fs.readFileSync(balanceFile));

  if (fs.existsSync(dataFile))
    transactions = JSON.parse(fs.readFileSync(dataFile));

  const today = DateTime.now().setZone("Asia/Tehran");
  const start = today.startOf("day");
  const end = today.endOf("day");

  const todayTx = getTransactionsInRange(transactions, start, end);

  const dailyProfit = calculateProfit(todayTx);

  const currencyStats = calculateCurrencyStats(transactions);

  const balanceMsg = buildBalanceMessage(currencyStats, balances);

  const msg = `📊 خلاصه وضعیت:
-------------------------
📆 تراکنش‌های امروز: ${todayTx.length}
🧾 تراز مالی: ${dailyProfit.toLocaleString("fa-IR")} تومان
-------------------------${balanceMsg}`;

  bot.sendMessage(chatId, msg);
}

function getTransactionsInRange(transactions, from, to) {
  return transactions.filter(t => {
    const txDate = DateTime.fromISO(t.date, { zone: "Asia/Tehran" });
    return txDate >= from && txDate <= to;
  });
}

function calculateProfit(txList) {
  const buy = txList
    .filter((t) => t.type === "buy")
    .reduce((s, t) => s + t.amount, 0);
  const sell = txList
    .filter((t) => t.type === "sell")
    .reduce((s, t) => s + t.amount, 0);
  return sell - buy;
}

function calculateCurrencyStats(transactions) {
  const stats = {};
  for (const tx of transactions) {
    const cur = tx.currencyType || tx.itemType || "تومان";
    if (!stats[cur]) stats[cur] = { buyCount: 0, sellCount: 0 };

    const count = Number(tx.count) || 0;
    if (tx.type === "buy") stats[cur].buyCount += count;
    else if (tx.type === "sell") stats[cur].sellCount += count;
  }

  return stats;
}
function buildBalanceMessage(currencyStats, balances) {
  let msg = "\n💰 تراز دارایی‌ها:\n";
  const formatter = new Intl.NumberFormat("fa-IR");

  const allCurrencies = new Set([
    ...Object.keys(currencyStats),
    ...Object.keys(balances),
  ]);

  for (const cur of allCurrencies) {
    const stats = currencyStats[cur] || { buyCount: 0, sellCount: 0 };
    const startBalance = Number(balances[cur]) || 0;

    if (cur === "طلا") {
      const finalToman = startBalance + (stats.buyCount - stats.sellCount);
      msg += `🏅 ${cur}: ${formatter.format(finalToman)} تومان\n`;
      continue;
    }

    // سایر ارزها
    const finalCount = startBalance + (stats.buyCount - stats.sellCount);
    const sign =
      finalCount > startBalance
        ? "🟢"
        : finalCount < startBalance
        ? "🔴"
        : "⚪️";

    msg += `${sign} ${cur}: ${formatter.format(
      finalCount
    )} (شروع ${formatter.format(startBalance)})\n`;
  }

  return msg;
}
