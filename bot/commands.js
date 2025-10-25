import fs from "fs";
import { bot } from "./bot.js";
import {
  ADMIN_CHAT_ID,
  USERS_FILE,
  APPROVAL_DURATION_DAYS,
} from "../config.js";
import { sendMainMenu } from "./menu.js";

export function handleStart(msg) {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "کاربر";
  registerUser(chatId, name);
  // sendMainMenu(chatId);
}

export function handleApprove(msg, match) {
  const chatId = msg.chat.id;
  if (chatId !== ADMIN_CHAT_ID)
    return bot.sendMessage(chatId, "⛔ شما دسترسی ادمین ندارید.");

  const targetChatId = parseInt(match[1]);
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find((u) => u.chatId === targetChatId);

  if (!user) return bot.sendMessage(chatId, "❗ کاربر یافت نشد.");

  user.status = "approved";
  user.approvedUntil = new Date(
    Date.now() + APPROVAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  );
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  bot.sendMessage(chatId, `✅ کاربر ${user.name} تأیید شد.`);
  bot.sendMessage(
    targetChatId, `✅ دسترسی شما تا ۳۰ روز آینده فعال شد. حالا می‌توانید از ربات استفاده کنید. \n/start)`)
}

function registerUser(chatId, name) {
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
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
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    bot.sendMessage(
      ADMIN_CHAT_ID,
      `📢 کاربر جدید درخواست دسترسی داده:\n👤 ${name}\n🆔 ${chatId}\n\nبرای تأیید تا ۳۰ روز آینده دستور زیر را ارسال کن:\n/approve ${chatId}`
    );
    bot.sendMessage(
      chatId,
      "⏳ درخواست شما برای استفاده از ربات ثبت شد. لطفاً منتظر تأیید ادمین باشید."
    );
  } else {
    if (user.status === "approved") sendMainMenu(chatId);
    else if (user.status === "expired")
      bot.sendMessage(
        chatId,
        "❌ مدت اعتبار شما منقضی شده است. لطفاً منتظر تأیید مجدد باشید."
      );
    else bot.sendMessage(chatId, "⏳ درخواست شما در انتظار تأیید ادمین است.");
  }
}
