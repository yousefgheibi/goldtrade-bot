import dotenv from "dotenv";
dotenv.config({ debug: false });

export const TOKEN = process.env.TELEGRAM_TOKEN;
export const ADMIN_CHAT_ID = 507528648;
export const DATA_DIR = "./data";
export const EXPORT_DIR = "./exports";
export const USERS_FILE = "./users.json";
export const APPROVAL_DURATION_DAYS = 30;