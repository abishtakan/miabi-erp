const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-LK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Colombo",
});

export function formatLkr(value: string | number) {
  return currencyFormatter.format(Number(value));
}

export function formatColomboDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

export function brandLabel(brand: "LOLARK" | "MUNDHANAI") {
  return brand === "LOLARK" ? "Lolark" : "Mundhanai";
}

export function channelLabel(channel: "ONLINE" | "POP_UP_STALL") {
  return channel === "ONLINE" ? "Online" : "Pop-up stall";
}
