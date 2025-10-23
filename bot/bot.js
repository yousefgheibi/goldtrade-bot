import TelegramBot from "node-telegram-bot-api";
import { TOKEN } from "../config.js";
import { handleStart, handleApprove } from "./commands.js";
import { handleMessage } from "./transactions.js";

export const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, handleStart);
bot.onText(/\/approve (.+)/, handleApprove);
bot.on("message", handleMessage);