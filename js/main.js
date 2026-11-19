/* =====================================================
   main.js — Cláudia Menegotto v2
   Responsabilidades:
   · Sticky header com glassmorphism ao rolar
   · Menu mobile (hambúrguer)
   · Animações de entrada com IntersectionObserver
   · Ano dinâmico no footer
   · Contadores numéricos animados
   ===================================================== */

(function () {
  'use strict';

  /* ── 1. Ano dinâmico ── */
  document.querySelectorAll('[data-ano]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ── 2. Sticky header com glassmorphism ── */
  const header = document.getElementById('header');
  if (header) {
    const toggleScrolled = () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };
    // Verifica estado inicial (caso a página carregue já rolada)
    toggleScrolled();
    window.addEventListener('scroll', toggleScrolled, { passive: true });
  }

  /* ── 3. Menu mobile ── */
  const navToggle = document.getElementById('nav-toggle');
  const siteNav   = document.getElementById('site-nav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const aberto = siteNav.classList.toggle('aberto');
      navToggle.classList.toggle('ativo', aberto);
      navToggle.setAttribute('aria-expanded', String(aberto));
      // Bloqueia scroll do body quando o menu está aberto
      document.body.style.overflow = aberto ? 'hidden' : '';
    });

    // Fecha ao clicar em qualquer link do menu
    siteNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        siteNav.classList.remove('aberto');
        navToggle.classList.remove('ativo');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Fecha ao pressionar Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && siteNav.classList.contains('aberto')) {
        siteNav.classList.remove('aberto');
        navToggle.classList.remove('ativo');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        navToggle.focus();
      }
    });
  }

  /* ── 4. Animações de entrada ── */
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (!prefersReducedMotion) {
    const revelarEls = document.querySelectorAll(
      '.revelar, .revelar-esq'
    );

    if (revelarEls.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visivel');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      revelarEls.forEach(el => observer.observe(el));
    }
  } else {
    // Para quem prefere movimento reduzido, mostra tudo imediatamente
    document.querySelectorAll('.revelar, .revelar-esq').forEach(el => {
      el.classList.add('visivel');
    });
  }

  /* ── 5. Contadores numéricos animados ── */
  function animarContador(el, destino, duracao) {
    const inicio     = performance.now();
    const valorInicio = 0;

    function atualizar(agora) {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      // Easing: ease-out cúbico
      const easedProgress = 1 - Math.pow(1 - progresso, 3);
      const valorAtual = Math.round(valorInicio + easedProgress * destino);
      el.textContent   = valorAtual;

      if (progresso < 1) {
        requestAnimationFrame(atualizar);
      } else {
        el.textContent = destino;
      }
    }

    requestAnimationFrame(atualizar);
  }

  if (!prefersReducedMotion) {
    const numValues = document.querySelectorAll('.num-valor');

    if (numValues.length > 0) {
      const numObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const el     = entry.target;
              const em     = el.querySelector('em');
              const sufixo = em ? em.outerHTML : '';
              // Extrai apenas o número do texto
              const num    = parseInt(el.textContent.replace(/\D/g, ''), 10);

              if (!isNaN(num) && num > 0) {
                // Limpa e reinsere após animar
                el.textContent = '0';
                animarContador(el, num, 1200);
                // Re-adiciona o sufixo após a animação
                setTimeout(() => {
                  if (sufixo) el.insertAdjacentHTML('beforeend', sufixo);
                }, 1250);
              }

              numObserver.unobserve(el);
            }
          });
        },
        { threshold: 0.5 }
      );

      numValues.forEach(el => numObserver.observe(el));
    }
  }

  /* ── 6. Smooth reveal para o hero (sem observer, dispara ao carregar) ── */
  window.addEventListener('load', () => {
    if (!prefersReducedMotion) {
      // Pequeno delay para garantir que o CSS já foi aplicado
      setTimeout(() => {
        document.querySelectorAll('.hero .revelar, .hero .revelar-esq').forEach(el => {
          el.classList.add('visivel');
        });
      }, 100);
    }
  });

})();
