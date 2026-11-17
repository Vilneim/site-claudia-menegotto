// Galeria dos Arcanos: lê data/arcanos.json e monta miniaturas + ampliação.
const galeria = document.getElementById('galeria');
if (galeria) {
  const dlg = document.getElementById('ampliada');
  let lista = [], atual = 0;
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e; };

  function foto(a, grande) {
    const f = el('div', 'foto'); f.dataset.n = a.numero;
    const img = el('img'); img.alt = a.alt || `Bordado do arcano ${a.nome}`;
    img.src = grande ? a.imagem_grande : a.imagem_mini; img.loading = 'lazy';
    img.onerror = () => { img.remove(); f.classList.add('sem-foto'); };
    f.append(img); return f;
  }
  function abrir(i) {
    atual = (i + lista.length) % lista.length;
    const a = lista[atual], box = dlg.querySelector('.lb');
    box.replaceChildren(foto(a, true));
    const t = el('div'); t.append(el('h3', '', `${a.numero} · ${a.nome}`));
    if (a.frase) t.append(el('p', 'frase', a.frase));
    if (a.pergunta) t.append(el('p', 'pergunta', a.pergunta));
    const nav = el('div', 'lb-nav');
    [['Anterior', () => abrir(atual - 1)], ['Próximo', () => abrir(atual + 1)], ['Fechar', () => dlg.close()]].forEach(([n, f]) => {
      const b = el('button', 'botao', n); b.type = 'button'; b.onclick = f; nav.append(b);
    });
    t.append(nav); box.append(t);
    if (!dlg.open) dlg.showModal();
  }
  fetch('/data/arcanos.json').then(r => r.json()).then(d => {
    lista = d;
    d.forEach((a, i) => {
      const b = el('button'); b.type = 'button'; b.setAttribute('aria-label', `Ampliar ${a.nome}`);
      b.append(foto(a, false), el('span', '', `${a.numero} · ${a.nome}`));
      b.onclick = () => abrir(i); galeria.append(b);
    });
  }).catch(() => galeria.textContent = 'Não foi possível carregar a exposição. Se estiver testando no computador, abra pelo servidor local (veja o LEIAME).');
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') abrir(atual + 1); if (e.key === 'ArrowLeft') abrir(atual - 1); });
}
document.querySelectorAll('[data-ano]').forEach(e => e.textContent = new Date().getFullYear());
