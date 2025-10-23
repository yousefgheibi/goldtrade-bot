import { bot } from "./bot.js";
import { ADMIN_CHAT_ID } from "../config.js";

export function sendMainMenu(chatId) {
  if (chatId === ADMIN_CHAT_ID) {
    bot.sendMessage(chatId, "🛠 منوی ادمین:", {
      reply_markup: {
        keyboard: [["📤 خروجی کاربران", "💾 بکاپ کل داده‌ها"]],
        resize_keyboard: true
      }
    });
  } else {
    bot.sendMessage(chatId, "📊 لطفاً یکی از گزینه‌ها را انتخاب کنید:", {
      reply_markup: {
        keyboard: [
          ["🟢 ثبت خرید", "🔴 ثبت فروش"],
          ["📈 خلاصه وضعیت", "📤 خروجی فایل"]
        ],
        resize_keyboard: true
      }
    });
  }
}
