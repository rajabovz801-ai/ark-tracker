export function isInvalidTerminalMessage(message: string): boolean {
  const text = message.toLocaleLowerCase('uz-UZ');
  return text.includes('terminal kodi noto') ||
    text.includes('terminal kod noto') ||
    text.includes('terminal tasdiqlanmagan') ||
    text.includes('terminalni administrator ulashi kerak');
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'] as const;

export function formatTerminalDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(p.day) + ' ' + MONTHS[Number(p.month) - 1] + ' ' + p.year;
}
