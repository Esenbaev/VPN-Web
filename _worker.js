// Cloudflare Pages («advanced mode»): закрывает сайт для посетителей из Кыргызстана по IP-адресу.
// Страну определяем по базе DB-IP Country Lite (CC BY 4.0): https://db-ip.com
// Диапазоны IP вносит скрипт make_worker.py в три строки с пометками @DB_INFO, @KG_V4, @KG_V6.

const DB_INFO = ''; // @DB_INFO
const KG_V4 = []; // @KG_V4
const KG_V6 = []; // @KG_V6

const V6 = KG_V6.map(([a, b]) => [BigInt('0x' + a), BigInt('0x' + b)]);

function v4ToNum(s) {
  const p = s.split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || +x > 255) return null;
    n = n * 256 + +x;
  }
  return n;
}

function v6ToBig(s) {
  s = s.split('%')[0];
  if (s.includes('.')) { // например ::ffff:1.2.3.4
    const i = s.lastIndexOf(':');
    const n = v4ToNum(s.slice(i + 1));
    if (n === null) return null;
    s = s.slice(0, i + 1) + Math.floor(n / 65536).toString(16) + ':' + (n % 65536).toString(16);
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = 8 - head.length - tail.length;
  if (parts.length === 1 ? head.length !== 8 : fill < 1) return null;
  const groups = parts.length === 2 ? [...head, ...Array(fill).fill('0'), ...tail] : head;
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt('0x' + g);
  }
  return n;
}

function inRanges(list, x) {
  let lo = 0, hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (x < list[mid][0]) hi = mid - 1;
    else if (x > list[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}

function isKyrgyzstan(ip) {
  if (!ip) return false;
  if (!ip.includes(':')) {
    const n = v4ToNum(ip);
    return n !== null && inRanges(KG_V4, n);
  }
  const n = v6ToBig(ip);
  if (n === null) return false;
  if ((n >> 32n) === 0xffffn) return inRanges(KG_V4, Number(n & 0xffffffffn)); // IPv4 в формате IPv6
  return inRanges(V6, n);
}

const BLOCK_PAGE = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Сайт недоступен в вашем регионе</title>
<style>
:root{--bg:#f2f5f7;--ink:#0f1b24;--mute:#4d5d69;--stop:#b3261e;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0e1519;--ink:#e5edf1;--mute:#98a9b4;--stop:#f2877f;color-scheme:dark}}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--ink);font:400 1.0625rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{min-height:100%;max-width:36rem;margin:0 auto;padding:2rem 1.5rem;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center}
svg{width:4.5rem;height:4.5rem;color:var(--stop);margin-bottom:1.5rem}
h1{font-size:clamp(1.9rem,6vw,2.6rem);line-height:1.15;letter-spacing:-.01em;margin:0 0 .75rem}
p{margin:0 0 .5rem;max-width:30rem}
.en,.src{color:var(--mute)}
.src{margin-top:2rem;font-size:.9rem}
.src a{color:inherit}
</style>
</head>
<body>
<main>
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M14 50 50 14"/></svg>
  <h1>Сайт недоступен в вашем регионе</h1>
  <p>Доступ к этому сайту для посетителей из Кыргызской Республики закрыт.</p>
  <p class="en">This website is not available in your region.</p>
  <p class="src"><a href="https://db-ip.com">IP Geolocation by DB-IP</a></p>
</main>
</body>
</html>`;

const NO_STORE = { 'cache-control': 'no-store' };

export default {
  async fetch(request, env) {
    // Пока в файл не внесены диапазоны IP, сайт не открывается ни для кого — чтобы не остаться без защиты незаметно.
    if (!KG_V4.length && !KG_V6.length) {
      return new Response('Диапазоны IP (DB-IP Country Lite) не загружены. Запустите make_worker.py и загрузите папку site заново.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE },
      });
    }
    if (isKyrgyzstan(request.headers.get('CF-Connecting-IP'))) {
      return new Response(BLOCK_PAGE, {
        status: 403,
        headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE },
      });
    }
    return env.ASSETS.fetch(request); // остальным странам — сайт как обычно
  },
};
