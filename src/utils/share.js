export function shareToWhatsApp(text, url) {
  const body = text + '\n\n' + url;
  const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
  const waUrl = isMobile
    ? 'whatsapp://send?text=' + encodeURIComponent(body)
    : 'https://web.whatsapp.com/send?text=' + encodeURIComponent(body);

  const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
  if (!win || win.closed) {
    navigator.clipboard.writeText(body).then(() => {
      alert('Copied! Paste into WhatsApp to share.');
    }).catch(() => {});
  }
}

export function stripMarkdown(md) {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(' ', maxLen);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, maxLen)) + '…';
}
