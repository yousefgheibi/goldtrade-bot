import fs from "fs";
import { DATA_DIR, EXPORT_DIR, USERS_FILE } from "./config.js";
import { bot } from "./bot/bot.js";

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");

console.log("🤖 بات آماده است...");