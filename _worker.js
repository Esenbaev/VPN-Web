// Cloudflare Pages (advanced mode): блокировка посетителей по IP-адресу.
// Cloudflare сам определяет страну по IP и передаёт её в request.cf.country.
// Список стран по кодам ISO 3166-1: KG — Кыргызская Республика.
const BLOCKED_COUNTRIES = ['KG'];

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
.en{color:var(--mute)}
</style>
</head>
<body>
<main>
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M14 50 50 14"/></svg>
  <h1>Сайт недоступен в вашем регионе</h1>
  <p>Доступ к этому сайту для посетителей из Кыргызской Республики закрыт.</p>
  <p class="en">This website is not available in your region.</p>
</main>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const country = request.cf && request.cf.country;
    if (country && BLOCKED_COUNTRIES.includes(country)) {
      return new Response(BLOCK_PAGE, {
        status: 403,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }
    // Остальным странам отдаём сайт как обычно.
    return env.ASSETS.fetch(request);
  },
};
