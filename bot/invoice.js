import fs from "fs";
import { createCanvas, registerFont } from "canvas";

registerFont("./assets/font/vazirmatn.ttf", { family: "Vazirmatn" });

export function createInvoiceImage(entry, outputPath, callback) {
  const width = 600;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fffcf8";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 32px Vazirmatn";
  ctx.fillText("گالری یامـــور", 200, 80);
  ctx.textAlign = "right";

  const startX = width - 40;
  let startY = 120;
  const lineHeight = 40;

  ctx.fillStyle = "#333";
  ctx.font = "20px Vazirmatn";
  ctx.fillText(`تاریخ: ${entry.date}`, startX, startY);
  startY += lineHeight;
  ctx.fillText(
    `نوع تراکنش: ${entry.type === "buy" ? "خرید" : "فروش"}`,
    startX,
    startY
  );
  startY += lineHeight;
  ctx.fillText(`نام: ${entry.name}`, startX, startY);
  startY += lineHeight;
  ctx.fillText(`نوع کالا: ${entry.itemType}`, startX, startY);
  startY += lineHeight;

  if (entry.itemType === "طلا") {
    ctx.fillText(
      `قیمت مثقال: ${entry.priceMithqal.toLocaleString("fa-IR")} میلیون تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(
      `مبلغ کل: ${entry.amount.toLocaleString("fa-IR")} میلیون تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(
      `وزن: ${entry.weight.toLocaleString("fa-IR")} گرم`,
      startX,
      startY
    );
  } else if (entry.itemType === "سکه") {
    ctx.fillText(`نوع سکه: ${entry.coinType}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(
      `قیمت پایه: ${entry.basePrice.toLocaleString("fa-IR")} میلیون تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(`تعداد: ${entry.quantity}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(
      `مبلغ کل: ${entry.amount.toLocaleString("fa-IR")} میلیون تومان`,
      startX,
      startY
    );
  } else if (entry.itemType === "ارز") {
    ctx.fillText(`نوع ارز: ${entry.currencyType}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(
      `قیمت پایه: ${entry.basePrice.toLocaleString("fa-IR")} میلیون تومان`,
      startX,
      startY
    );
    startY += lineHeight;
    ctx.fillText(`تعداد: ${entry.quantity}`, startX, startY);
    startY += lineHeight;
    ctx.fillText(
      `مبلغ کل: ${entry.amount.toLocaleString("fa-IR")} میلیون تومان`,
      startX,
      startY
    );
  }

  startY += lineHeight;
  ctx.fillText(`توضیحات: ${entry.desc}`, startX, startY);

  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
  callback();
}
