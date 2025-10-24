import { bot } from "./bot.js";
import { ADMIN_CHAT_ID } from "../config.js";

export function sendMainMenu(chatId) {
  let keyboard;

  if (chatId === ADMIN_CHAT_ID) {
    keyboard = [["کاربران", "بکاپ"]];
  } else {
    keyboard = [
      ["🟢 ثبت خرید", "🔴 ثبت فروش"],
      ["خلاصه وضعیت", "ثبت موجودی", "خروجی فایل"],
    ];
  }

  bot.sendMessage(chatId, "لطفاً گزینه را انتخاب کنید:", {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  });
}
