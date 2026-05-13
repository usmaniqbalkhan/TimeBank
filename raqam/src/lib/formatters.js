const currencyFormatter = new Intl.NumberFormat('en-PK');

export function formatCurrencyFromPaisa(amountPaisa) {
  const rupees = Math.round(Number(amountPaisa || 0) / 100);
  return `PKR ${currencyFormatter.format(rupees)}`;
}

export function formatRupeeInput(amount) {
  return `PKR ${currencyFormatter.format(Number(amount || 0))}`;
}

export function toPaisa(amountRupees) {
  const parsed = Number(amountRupees);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffInDays = Math.round((startOfToday - startOfDate) / 86400000);

  if (diffInDays === 0) {
    return `Today, ${date.toLocaleTimeString('en-PK', {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  if (diffInDays === 1) {
    return 'Yesterday';
  }

  return date.toLocaleString('en-PK', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function normalizeWalletCode(value) {
  return value.replace(/\D/g, '').slice(0, 4);
}

export function normalizeQrPayload(payload = '') {
  return payload.trim().replace(/^raqam:/i, '');
}
