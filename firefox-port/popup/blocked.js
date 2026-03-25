const hash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
const params = new URLSearchParams(location.search);
const domain = hash || params.get('domain') || 'bilinmeyen site';

// Hash'i adres çubuğundan temizle
if (location.hash) history.replaceState(null, '', location.pathname);
document.getElementById('domainDisplay').textContent = domain;
document.title = `Engellendi: ${domain}`;

const now = new Date();
try {
  document.getElementById('infoDate').textContent = now.toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });
  document.getElementById('infoTime').textContent = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
} catch(e) {
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('infoDate').textContent = `${pad(now.getDate())}.${pad(now.getMonth()+1)}.${now.getFullYear()}`;
  document.getElementById('infoTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

const c = document.getElementById('particles');
for (let i = 0; i < 20; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  const s = 1 + Math.random() * 2;
  p.style.cssText = `left:${Math.random()*100}%;width:${s}px;height:${s}px;animation-duration:${7+Math.random()*9}s;animation-delay:${Math.random()*7}s;--d:${(Math.random()-.5)*80}px;opacity:${.25+Math.random()*.4}`;
  c.appendChild(p);
}
