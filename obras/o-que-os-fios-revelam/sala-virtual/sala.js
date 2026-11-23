import * as THREE from 'three';
import { ARCANOS, urlMiniatura, urlGrande } from './arcanos-data.js';

/* =====================================================
   CONFIGURAÇÕES PRINCIPAIS (ajustáveis)
   ===================================================== */
const CONFIG = {
  // Moldura preta fosca: 4% da largura da obra
  fatorEspessuraMoldura: 0.04,
  profundidadeMoldura: 0.045,

  // Dimensões máximas da fotografia na cena (em metros), preservando proporção
  larguraMaxObra: 0.92,
  alturaMaxObra: 1.22,
  alturaCentroObra: 1.50,

  // Layout programático do corredor para os 22 cavaletes
  larguraSala: 7.6,
  alturaSala: 4.0,
  xCavalete: 1.85,
  zInicialCavalete: -1.2,
  passoZ: 4.0,
  rotacaoCavalete: Math.PI * 0.22,
  margemEntrada: 5.2,
  margemFundo: 4.2,

  // Distância frontal diante de cada bordado
  distanciaObservacaoDesktop: 2.18,
  distanciaObservacaoMobile: 2.70,

  // Duração do deslocamento suave entre uma obra e a próxima (segundos)
  duracaoTrecho: 2.2,

  // Geometria do fio dourado no piso
  segmentosPorTrechoFio: 48,
  segmentosRadiaisFio: 8,
  raioFio: 0.024,

  // Otimização de memória e carregamento progressivo
  raioCarregamento: 3,
  raioDescarte: 5,
  maxCarregamentosSimultaneos: 2
};

/* =====================================================
   ILUMINAÇÃO DE GALERIA (ajuste livre das intensidades)
   ===================================================== */
const ILUMINACAO = {
  corFundoNeblina: 0xD2C8B8,
  ambienteCor: 0xFFF3E0,
  ambienteIntensidade: 0.45,
  hemisfericaCeu: 0xFFF7EA,
  hemisfericaChao: 0x8F7C66,
  hemisfericaIntensidade: 0.32,

  // Pool de 3 refletores (obra atual em destaque + vizinhas discretas)
  refletorCor: 0xFFE9C4,
  refletorAtualIntensidade: 16.0,
  refletorVizinhoIntensidade: 5.5,
  refletorDistancia: 9.0,
  refletorAngulo: Math.PI / 5.2,
  refletorPenumbra: 0.82,
  refletorDecaimento: 1.45,

  // Luz dourada sutil que acompanha o fio no piso
  luzFioCor: 0xFFD966,
  luzFioIntensidade: 1.8,
  luzFioDistancia: 2.6
};

/* =====================================================
   CONFIGURAÇÕES DE ÁUDIO
   ===================================================== */
const AUDIO_CONFIG = {
  chaveSessao: 'sala-virtual-som',
  urlClique: './audio/click-351398.mp3',
  urlMovimento: './audio/movimento-suave.mp3',
  volumeClique: 0.28,
  volumeMovimento: 0.22,
  intervaloMinCliqueMs: 90,
  fadeInMovimentoMs: 260,
  fadeOutMovimentoMs: 520
};

/* =====================================================
   ELEMENTOS DE INTERFACE
   ===================================================== */
const canvas         = document.getElementById('sala-canvas');
const topbar         = document.querySelector('.sala-topbar');
const btnSom         = document.getElementById('btn-som');
const hud            = document.getElementById('sala-hud');
const hudInfo        = document.querySelector('.hud-info');
const hudControles   = document.querySelector('.hud-controles');
const hudNumero      = document.getElementById('hud-numero');
const hudNome        = document.getElementById('hud-nome');
const hudProgresso   = document.getElementById('hud-progresso');
const btnAnterior    = document.getElementById('btn-anterior');
const btnProximo     = document.getElementById('btn-proximo');
const btnVerObra     = document.getElementById('btn-ver-obra');
const btnInicio      = document.getElementById('btn-inicio');
const avisosEl       = document.getElementById('sala-avisos');
const fallbackEl     = document.getElementById('sala-fallback');
const fallbackGrid   = document.getElementById('fallback-grid');

const modal          = document.getElementById('modal-obra');
const modalFoto      = document.getElementById('modal-foto');
const modalNumero    = document.getElementById('modal-numero');
const modalNome      = document.getElementById('modal-nome');
const modalFrase     = document.getElementById('modal-frase');
const modalPergunta  = document.getElementById('modal-pergunta');
const modalFechar    = document.getElementById('modal-fechar');
const modalFecharBtn = document.getElementById('modal-fechar-btn');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const modoDebug = new URLSearchParams(window.location.search).get('debug') === '1';
const EIXO_Y = new THREE.Vector3(0, 1, 0);

/* =====================================================
   GERENCIADOR DE ÁUDIO (inicia desativado; seguro se faltar arquivo)
   ===================================================== */
function criarGerenciadorAudio() {
  let ativo = false;
  let ultimoCliqueMs = 0;
  let fadeRafId = null;
  let movimentoDisponivel = true;
  let cliqueDisponivel = true;

  const audioClique = new Audio(AUDIO_CONFIG.urlClique);
  audioClique.preload = 'none';
  audioClique.volume = AUDIO_CONFIG.volumeClique;
  audioClique.addEventListener('error', () => {
    cliqueDisponivel = false;
  });

  const audioMovimento = new Audio(AUDIO_CONFIG.urlMovimento);
  audioMovimento.preload = 'none';
  audioMovimento.volume = 0;
  audioMovimento.addEventListener('error', () => {
    movimentoDisponivel = false;
  });

  function cancelarFade() {
    if (fadeRafId !== null) {
      cancelAnimationFrame(fadeRafId);
      fadeRafId = null;
    }
  }

  function animarVolume(audio, destino, duracaoMs, aoConcluir) {
    cancelarFade();
    const volInicio = audio.volume;
    const inicio = performance.now();

    function passo(agora) {
      const t = duracaoMs > 0 ? Math.min((agora - inicio) / duracaoMs, 1) : 1;
      audio.volume = THREE.MathUtils.clamp(
        volInicio + (destino - volInicio) * t,
        0,
        1
      );

      if (t < 1) {
        fadeRafId = requestAnimationFrame(passo);
      } else {
        fadeRafId = null;
        if (aoConcluir) aoConcluir();
      }
    }

    fadeRafId = requestAnimationFrame(passo);
  }

  function atualizarBotaoSom() {
    if (!btnSom) return;
    btnSom.textContent = ativo ? 'Silenciar' : 'Ativar som';
    btnSom.setAttribute('aria-pressed', String(ativo));
  }

  function definirAtivo(novoEstado, salvarSessao = true) {
    ativo = Boolean(novoEstado);
    atualizarBotaoSom();

    if (salvarSessao) {
      try {
        sessionStorage.setItem(AUDIO_CONFIG.chaveSessao, ativo ? 'ativo' : 'silenciado');
      } catch {
        // Ignora caso o navegador bloqueie sessionStorage
      }
    }

    if (!ativo) {
      pararMovimento(true);
    } else {
      // Prepara os arquivos após gesto voluntário do visitante
      if (cliqueDisponivel) audioClique.load();
      if (movimentoDisponivel) audioMovimento.load();
    }
  }

  function tocarClique() {
    if (!ativo || !cliqueDisponivel) return;
    const agora = performance.now();
    if (agora - ultimoCliqueMs < AUDIO_CONFIG.intervaloMinCliqueMs) return;
    ultimoCliqueMs = agora;

    try {
      audioClique.pause();
      audioClique.currentTime = 0;
      audioClique.volume = AUDIO_CONFIG.volumeClique;
      const p = audioClique.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Ignora restrições de reprodução
    }
  }

  function iniciarMovimento() {
    if (!ativo || !movimentoDisponivel) return;
    cancelarFade();

    try {
      audioMovimento.pause();
      audioMovimento.currentTime = 0;
      audioMovimento.volume = 0;
      const p = audioMovimento.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (ativo) {
            animarVolume(
              audioMovimento,
              AUDIO_CONFIG.volumeMovimento,
              AUDIO_CONFIG.fadeInMovimentoMs
            );
          }
        }).catch(() => {});
      }
    } catch {
      // Ignora se arquivo ausente ou bloqueado
    }
  }

  function pararMovimento(imediato = false) {
    if (!movimentoDisponivel) return;
    if (audioMovimento.paused && audioMovimento.volume === 0) {
      cancelarFade();
      return;
    }

    if (imediato) {
      cancelarFade();
      audioMovimento.pause();
      audioMovimento.currentTime = 0;
      audioMovimento.volume = 0;
      return;
    }

    animarVolume(audioMovimento, 0, AUDIO_CONFIG.fadeOutMovimentoMs, () => {
      audioMovimento.pause();
      audioMovimento.currentTime = 0;
    });
  }

  // Inicia desativado; preserva preferência da sessão apenas se já ativada antes
  try {
    if (sessionStorage.getItem(AUDIO_CONFIG.chaveSessao) === 'ativo') {
      ativo = true;
    }
  } catch {
    ativo = false;
  }
  atualizarBotaoSom();

  if (btnSom) {
    btnSom.addEventListener('click', () => {
      definirAtivo(!ativo, true);
      if (ativo) tocarClique();
    });
  }

  return {
    tocarClique,
    iniciarMovimento,
    pararMovimento
  };
}

const gerenciadorAudio = criarGerenciadorAudio();

/* =====================================================
   POSIÇÕES PROGRAMÁTICAS DOS 22 ARCANOS
   ===================================================== */
const OBRAS = ARCANOS.map((arcano, i) => {
  const lado = i % 2 === 0 ? -1 : 1;
  return {
    ...arcano,
    indice: i,
    lado,
    urlMini: urlMiniatura(arcano),
    urlGrande: urlGrande(arcano),
    posicao: {
      x: lado * CONFIG.xCavalete,
      z: CONFIG.zInicialCavalete - i * CONFIG.passoZ,
      rotY: -lado * CONFIG.rotacaoCavalete
    }
  };
});

/* =====================================================
   ESTADO DA APLICAÇÃO
   ===================================================== */
let indiceAtual = 0;
const obrasInterativas = [];
const pontosObservacao = [];
const curvasCameraTrechos = [];

const estadoPercurso = {
  ativo: false,
  progressoAtual: 0,
  progressoInicio: 0,
  progressoDestino: 0,
  progressoMaximoFio: 0,
  inicioTempo: 0,
  duracaoMs: CONFIG.duracaoTrecho * 1000
};

/* =====================================================
   UTILITÁRIOS: WEBGL E AVISOS
   ===================================================== */
function verificarWebGL() {
  try {
    const teste = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (teste.getContext('webgl2') || teste.getContext('webgl') || teste.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

const avisosRegistrados = new Set();
function registrarAviso(mensagem) {
  if (avisosRegistrados.has(mensagem)) return;
  avisosRegistrados.add(mensagem);
  avisosEl.hidden = false;
  const p = document.createElement('p');
  p.textContent = mensagem;
  avisosEl.appendChild(p);
  console.warn('[Sala Virtual]', mensagem);
}

function ativarFallbackSemWebGL() {
  canvas.style.display = 'none';
  hud.hidden = true;
  if (btnSom) btnSom.hidden = true;
  fallbackEl.hidden = false;

  OBRAS.forEach((obra, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fallback-item';

    const img = document.createElement('img');
    img.src = obra.urlMini;
    img.alt = `Bordado do Arcano ${obra.nome}`;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.remove();
      const erro = document.createElement('div');
      erro.className = 'modal-erro-foto';
      erro.textContent = `Imagem não encontrada: ${obra.urlMini}`;
      btn.prepend(erro);
    });

    const legenda = document.createElement('span');
    legenda.className = 'fallback-item-legenda';
    legenda.innerHTML = `<strong>${obra.romano}</strong>${obra.nome}`;

    btn.append(img, legenda);
    btn.addEventListener('click', () => abrirModal(i));
    fallbackGrid.appendChild(btn);
  });
}

/* =====================================================
   MODAL ACESSÍVEL (Carrega foto grande somente aqui)
   ===================================================== */
function interromperPercurso(somImediato = false) {
  estadoPercurso.ativo = false;
  gerenciadorAudio.pararMovimento(somImediato);
}

function abrirModal(indice) {
  interromperPercurso(false);

  const obra = OBRAS[indice];
  if (!obra) return;

  modalFoto.innerHTML = '';
  const img = document.createElement('img');
  img.src = obra.urlGrande;
  img.alt = `Bordado do Arcano ${obra.nome}, ampliado`;

  img.addEventListener('error', () => {
    img.remove();
    const erro = document.createElement('div');
    erro.className = 'modal-erro-foto';
    erro.textContent = `Não foi possível carregar a fotografia original em "${obra.urlGrande}".`;
    modalFoto.appendChild(erro);
  });

  modalFoto.appendChild(img);
  modalNumero.textContent = `ARCANO ${obra.romano}`;
  modalNome.textContent = obra.nome;
  modalFrase.textContent = obra.frase;
  modalPergunta.textContent = obra.pergunta;

  if (!modal.open) {
    modal.showModal();
  }
}

function fecharModal() {
  if (modal.open) {
    modal.close();
  }
}

modalFechar.addEventListener('click', fecharModal);
modalFecharBtn.addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) fecharModal();
});

/* =====================================================
   TEXTURAS PROCEDURAIS COMPARTILHADAS
   ===================================================== */
function criarTexturaPisoMadeira(comprimentoSala) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#B89E82';
  ctx.fillRect(0, 0, 512, 512);

  const tabuas = 8;
  const largTabua = 512 / tabuas;
  for (let i = 0; i < tabuas; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 102, 74, 0.12)' : 'rgba(244, 239, 230, 0.08)';
    ctx.fillRect(i * largTabua, 0, largTabua, 512);

    ctx.strokeStyle = 'rgba(78, 60, 42, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(i * largTabua, 0);
    ctx.lineTo(i * largTabua, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, Math.max(10, Math.round(comprimentoSala / 1.6)));
  return tex;
}

function criarMapaReflexoDourado() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0,  '#FFFDF2');
  grad.addColorStop(0.28, '#FFE699');
  grad.addColorStop(0.50, '#F5C443');
  grad.addColorStop(0.72, '#C88D1E');
  grad.addColorStop(1.0,  '#7D5510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = 'rgba(255, 252, 235, 0.85)';
  ctx.fillRect(24, 18, 48, 22);
  ctx.fillRect(148, 22, 64, 20);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function criarTexturaErroImagem(obra) {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 640;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#231F1A';
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.strokeStyle = '#C49A50';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, c.width - 40, c.height - 40);

  ctx.fillStyle = '#E8D9B8';
  ctx.font = '600 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ARCANO ${obra.romano}`, c.width / 2, 220);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '28px Georgia, serif';
  ctx.fillText(obra.nome, c.width / 2, 275);

  ctx.fillStyle = '#C49A50';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Miniatura não encontrada', c.width / 2, 360);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* =====================================================
   CONSTRUÇÃO DA GALERIA 3D (22 ARCANOS)
   ===================================================== */
function iniciarCena3D() {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(ILUMINACAO.corFundoNeblina);
  cena.fog = new THREE.Fog(ILUMINACAO.corFundoNeblina, 11, 25);

  const camera = new THREE.PerspectiveCamera(
    47,
    window.innerWidth / window.innerHeight,
    0.1,
    38
  );

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });

  function aplicarResolucao() {
    const maxDpr = window.matchMedia('(max-width: 820px)').matches ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  aplicarResolucao();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  /* ── Renderização sob demanda e suspensão com aba oculta ── */
  let rafId = null;
  let abaOculta = document.hidden;
  let totalRenders = 0;

  function solicitarRender() {
    if (abaOculta || rafId !== null) return;
    rafId = requestAnimationFrame(executarQuadro);
  }

  document.addEventListener('visibilitychange', () => {
    abaOculta = document.hidden;
    if (abaOculta) {
      gerenciadorAudio.pararMovimento(true);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      solicitarRender();
    }
  });

  /* ── Iluminação intimista de galeria + pool de 3 refletores focais ── */
  cena.add(new THREE.AmbientLight(ILUMINACAO.ambienteCor, ILUMINACAO.ambienteIntensidade));

  const luzHemisferica = new THREE.HemisphereLight(
    ILUMINACAO.hemisfericaCeu,
    ILUMINACAO.hemisfericaChao,
    ILUMINACAO.hemisfericaIntensidade
  );
  luzHemisferica.position.set(0, 4, 0);
  cena.add(luzHemisferica);

  const poolRefletores = Array.from({ length: 3 }, () => {
    const spot = new THREE.SpotLight(
      ILUMINACAO.refletorCor,
      0,
      ILUMINACAO.refletorDistancia,
      ILUMINACAO.refletorAngulo,
      ILUMINACAO.refletorPenumbra,
      ILUMINACAO.refletorDecaimento
    );
    cena.add(spot, spot.target);
    return spot;
  });

  function atualizarPoolRefletores(centroIdx) {
    const alvos = [
      { idx: centroIdx,     intensidade: ILUMINACAO.refletorAtualIntensidade },
      { idx: centroIdx + 1, intensidade: ILUMINACAO.refletorVizinhoIntensidade },
      { idx: centroIdx - 1, intensidade: ILUMINACAO.refletorVizinhoIntensidade }
    ];

    poolRefletores.forEach((spot, k) => {
      const { idx, intensidade } = alvos[k];
      const obra = OBRAS[idx];
      if (!obra) {
        spot.intensity = 0;
        return;
      }
      spot.intensity = intensidade;
      const dirX = Math.sin(obra.posicao.rotY);
      const dirZ = Math.cos(obra.posicao.rotY);
      spot.position.set(
        obra.posicao.x + dirX * 1.25,
        3.65,
        obra.posicao.z + dirZ * 1.25
      );
      spot.target.position.set(obra.posicao.x, CONFIG.alturaCentroObra - 0.1, obra.posicao.z);
      spot.target.updateMatrixWorld();
    });
  }

  /* ── Arquitetura Programática da Sala ── */
  const zEntrada = CONFIG.zInicialCavalete + CONFIG.margemEntrada;
  const zUltimaObra = OBRAS[OBRAS.length - 1].posicao.z;
  const zFundo = zUltimaObra - CONFIG.margemFundo;
  const comprimentoSala = zEntrada - zFundo;
  const centroZ = (zEntrada + zFundo) * 0.5;
  const { larguraSala, alturaSala } = CONFIG;

  const pisoMat = new THREE.MeshStandardMaterial({
    map: criarTexturaPisoMadeira(comprimentoSala),
    roughness: 0.78,
    metalness: 0.04
  });
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(larguraSala, comprimentoSala), pisoMat);
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, centroZ);
  cena.add(piso);

  const tetoMat = new THREE.MeshStandardMaterial({ color: 0xF7F3EC, roughness: 0.95 });
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(larguraSala, comprimentoSala), tetoMat);
  teto.rotation.x = Math.PI / 2;
  teto.position.set(0, alturaSala, centroZ);
  cena.add(teto);

  const paredeMat = new THREE.MeshStandardMaterial({ color: 0xF4EFE6, roughness: 0.92 });
  const paredeLateralGeo = new THREE.PlaneGeometry(comprimentoSala, alturaSala);
  const paredeTopoGeo = new THREE.PlaneGeometry(larguraSala, alturaSala);

  const paredeEsq = new THREE.Mesh(paredeLateralGeo, paredeMat);
  paredeEsq.rotation.y = Math.PI / 2;
  paredeEsq.position.set(-larguraSala / 2, alturaSala / 2, centroZ);
  cena.add(paredeEsq);

  const paredeDir = new THREE.Mesh(paredeLateralGeo, paredeMat);
  paredeDir.rotation.y = -Math.PI / 2;
  paredeDir.position.set(larguraSala / 2, alturaSala / 2, centroZ);
  cena.add(paredeDir);

  const paredeFundo = new THREE.Mesh(paredeTopoGeo, paredeMat);
  paredeFundo.position.set(0, alturaSala / 2, zFundo);
  cena.add(paredeFundo);

  const paredeEntrada = new THREE.Mesh(paredeTopoGeo, paredeMat);
  paredeEntrada.rotation.y = Math.PI;
  paredeEntrada.position.set(0, alturaSala / 2, zEntrada);
  cena.add(paredeEntrada);

  const rodapeMat = new THREE.MeshStandardMaterial({ color: 0xDDD5C5, roughness: 0.85 });
  const rodapeLatGeo = new THREE.BoxGeometry(0.06, 0.14, comprimentoSala);

  const rodapeEsq = new THREE.Mesh(rodapeLatGeo, rodapeMat);
  rodapeEsq.position.set(-larguraSala / 2 + 0.03, 0.07, centroZ);
  cena.add(rodapeEsq);

  const rodapeDir = new THREE.Mesh(rodapeLatGeo, rodapeMat);
  rodapeDir.position.set(larguraSala / 2 - 0.03, 0.07, centroZ);
  cena.add(rodapeDir);

  const rodapeFundo = new THREE.Mesh(new THREE.BoxGeometry(larguraSala, 0.14, 0.06), rodapeMat);
  rodapeFundo.position.set(0, 0.07, zFundo + 0.03);
  cena.add(rodapeFundo);

  /* ── Fio Dourado Dinâmico Programático (22 Paradas) ── */
  const yFio = CONFIG.raioFio + 0.002;
  const pontosChaoFio = [
    new THREE.Vector3(0.05,  yFio, zEntrada - 0.55),
    new THREE.Vector3(-0.48, yFio, CONFIG.zInicialCavalete + 2.45)
  ];
  const alvosChaoParadas = [];

  OBRAS.forEach((obra, i) => {
    const pontoBase = new THREE.Vector3(obra.lado * 1.25, yFio, obra.posicao.z + 0.15);
    pontosChaoFio.push(pontoBase);
    alvosChaoParadas.push(pontoBase);

    if (i < OBRAS.length - 1) {
      const proxZ = OBRAS[i + 1].posicao.z;
      const pontoMeio = new THREE.Vector3(
        -obra.lado * 0.08,
        yFio,
        (obra.posicao.z + proxZ) * 0.5 + 0.1
      );
      pontosChaoFio.push(pontoMeio);
    }
  });

  const segmentosTubularesTotais = (OBRAS.length - 1) * CONFIG.segmentosPorTrechoFio;
  const curvaFio = new THREE.CatmullRomCurve3(pontosChaoFio, false, 'catmullrom', 0.5);
  const fioGeo = new THREE.TubeGeometry(
    curvaFio,
    segmentosTubularesTotais,
    CONFIG.raioFio,
    CONFIG.segmentosRadiaisFio,
    false
  );

  const fioMat = new THREE.MeshStandardMaterial({
    color: 0xF5C542,
    metalness: 0.72,
    roughness: 0.22,
    envMap: criarMapaReflexoDourado(),
    envMapIntensity: 1.4,
    emissive: 0x9C6B12,
    emissiveIntensity: 0.42
  });

  const fioDourado = new THREE.Mesh(fioGeo, fioMat);
  cena.add(fioDourado);

  const pontaFio = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.raioFio * 1.15, 12, 12),
    fioMat
  );
  cena.add(pontaFio);

  const luzFio = new THREE.PointLight(
    ILUMINACAO.luzFioCor,
    ILUMINACAO.luzFioIntensidade,
    ILUMINACAO.luzFioDistancia,
    2
  );
  cena.add(luzFio);

  const amostrasFio = 2400;
  const tabelaPontosFio = [];
  for (let i = 0; i <= amostrasFio; i++) {
    tabelaPontosFio.push(curvaFio.getPointAt(i / amostrasFio));
  }

  const tParadasFio = alvosChaoParadas.map((alvo) => {
    let melhorIdx = 0;
    let menorDist = Infinity;
    for (let i = 0; i <= amostrasFio; i++) {
      const dist = tabelaPontosFio[i].distanceToSquared(alvo);
      if (dist < menorDist) {
        menorDist = dist;
        melhorIdx = i;
      }
    }
    return melhorIdx / amostrasFio;
  });

  function mapearProgressoParaFio(progresso, comAdiantamento = true) {
    const ultimoIdx = OBRAS.length - 1;
    const p = THREE.MathUtils.clamp(progresso, 0, ultimoIdx);
    const seg = Math.min(Math.floor(p), ultimoIdx - 1);
    const u = p - seg;
    const uCurva = comAdiantamento ? Math.pow(u, 0.72) : u;
    return THREE.MathUtils.lerp(tParadasFio[seg], tParadasFio[seg + 1], uCurva);
  }

  function atualizarGeometriaFio(tVisivel, tPosicaoAtual) {
    const tLimitado = THREE.MathUtils.clamp(tVisivel, 0.002, 1);
    const segsVisiveis = Math.max(1, Math.round(tLimitado * segmentosTubularesTotais));
    const indicesPorSegmento = CONFIG.segmentosRadiaisFio * 6;
    fioGeo.setDrawRange(0, segsVisiveis * indicesPorSegmento);

    pontaFio.position.copy(curvaFio.getPointAt(tLimitado));

    const pontoLuz = curvaFio.getPointAt(THREE.MathUtils.clamp(tPosicaoAtual, 0.002, 1));
    luzFio.position.set(pontoLuz.x, 0.28, pontoLuz.z);
  }

  /* ── Geometrias e Materiais Compartilhados dos 22 Cavaletes ── */
  const geoPernaFrontal = new THREE.BoxGeometry(0.055, 2.08, 0.055);
  const geoPernaTras    = new THREE.BoxGeometry(0.055, 2.15, 0.055);
  const geoHasteCentral = new THREE.BoxGeometry(0.05, 1.85, 0.045);
  const geoPrateleira   = new THREE.BoxGeometry(0.98, 0.045, 0.14);
  const geoCaixaUnit    = new THREE.BoxGeometry(1, 1, 1);
  const geoPlanoUnit    = new THREE.PlaneGeometry(1, 1);

  const madeiraMat = new THREE.MeshStandardMaterial({
    color: 0x6E4E34,
    roughness: 0.76,
    metalness: 0.05
  });

  const molduraPretaMat = new THREE.MeshStandardMaterial({
    color: 0x161412,
    roughness: 0.92,
    metalness: 0.04
  });

  const placeholderFotoMat = new THREE.MeshBasicMaterial({
    color: 0xE8D9B8,
    toneMapped: false
  });

  /* ── Construção dos 22 Cavaletes ── */
  const slotsObras = OBRAS.map((obra, indice) => {
    const grupo = new THREE.Group();
    grupo.position.set(obra.posicao.x, 0, obra.posicao.z);
    grupo.rotation.y = obra.posicao.rotY;

    const pernaEsq = new THREE.Mesh(geoPernaFrontal, madeiraMat);
    pernaEsq.position.set(-0.34, 1.02, 0.02);
    pernaEsq.rotation.set(-0.06, 0, -0.07);
    grupo.add(pernaEsq);

    const pernaDir = new THREE.Mesh(geoPernaFrontal, madeiraMat);
    pernaDir.position.set(0.34, 1.02, 0.02);
    pernaDir.rotation.set(-0.06, 0, 0.07);
    grupo.add(pernaDir);

    const pernaTras = new THREE.Mesh(geoPernaTras, madeiraMat);
    pernaTras.position.set(0, 0.98, -0.42);
    pernaTras.rotation.x = 0.34;
    grupo.add(pernaTras);

    const hasteCentral = new THREE.Mesh(geoHasteCentral, madeiraMat);
    hasteCentral.position.set(0, 1.12, -0.02);
    hasteCentral.rotation.x = -0.06;
    grupo.add(hasteCentral);

    const prateleira = new THREE.Mesh(geoPrateleira, madeiraMat);
    prateleira.position.set(0, 0.86, 0.09);
    grupo.add(prateleira);

    const grupoQuadro = new THREE.Group();
    grupoQuadro.position.set(0, CONFIG.alturaCentroObra, 0.07);
    grupo.add(grupoQuadro);

    const fundo     = new THREE.Mesh(geoCaixaUnit, molduraPretaMat);
    const barraTopo = new THREE.Mesh(geoCaixaUnit, molduraPretaMat);
    const barraBase = new THREE.Mesh(geoCaixaUnit, molduraPretaMat);
    const barraEsq  = new THREE.Mesh(geoCaixaUnit, molduraPretaMat);
    const barraDir  = new THREE.Mesh(geoCaixaUnit, molduraPretaMat);

    const fotoMesh = new THREE.Mesh(geoPlanoUnit, placeholderFotoMat);
    fotoMesh.position.z = 0.004;
    fotoMesh.userData.indiceArcano = indice;

    grupoQuadro.add(fundo, barraTopo, barraBase, barraEsq, barraDir, fotoMesh);
    cena.add(grupo);
    obrasInterativas[indice] = fotoMesh;

    function aplicarProporcao(proporcao) {
      let largura = CONFIG.larguraMaxObra;
      let altura = largura / proporcao;
      if (altura > CONFIG.alturaMaxObra) {
        altura = CONFIG.alturaMaxObra;
        largura = altura * proporcao;
      }

      const esp = largura * CONFIG.fatorEspessuraMoldura;
      const prof = CONFIG.profundidadeMoldura;
      prateleira.position.y = CONFIG.alturaCentroObra - (altura / 2) - esp - 0.025;

      fundo.scale.set(largura + esp * 2, altura + esp * 2, 0.016);
      fundo.position.z = -prof / 2;

      barraTopo.scale.set(largura + esp * 2, esp, prof);
      barraTopo.position.set(0, altura / 2 + esp / 2, 0);

      barraBase.scale.set(largura + esp * 2, esp, prof);
      barraBase.position.set(0, -(altura / 2 + esp / 2), 0);

      barraEsq.scale.set(esp, altura, prof);
      barraEsq.position.set(-(largura / 2 + esp / 2), 0, 0);

      barraDir.scale.set(esp, altura, prof);
      barraDir.position.set(largura / 2 + esp / 2, 0, 0);

      fotoMesh.scale.set(largura, altura, 1);
    }

    aplicarProporcao(3 / 4);

    return {
      indice,
      obra,
      fotoMesh,
      aplicarProporcao,
      estado: 'vazio',
      textura: null,
      material: null
    };
  });

  /* ── Gerenciador de Carregamento Progressivo e Descarte (VRAM) ── */
  const carregadorTextura = new THREE.TextureLoader();
  let carregamentosAtivos = 0;
  let centroJanelaAtual = 0;
  const temposCarregamentoMs = [];

  function liberarSlot(slot) {
    if (slot.estado !== 'carregado' && slot.estado !== 'erro') return;
    slot.fotoMesh.material = placeholderFotoMat;
    if (slot.material) {
      slot.material.dispose();
      slot.material = null;
    }
    if (slot.textura) {
      slot.textura.dispose();
      slot.textura = null;
    }
    slot.estado = 'vazio';
  }

  function processarFilaCarregamento() {
    slotsObras.forEach((slot) => {
      if (Math.abs(slot.indice - centroJanelaAtual) > CONFIG.raioDescarte) {
        liberarSlot(slot);
      }
    });

    if (carregamentosAtivos >= CONFIG.maxCarregamentosSimultaneos) return;

    const candidatos = [];
    for (let d = 0; d <= CONFIG.raioCarregamento; d++) {
      const pares = d === 0 ? [centroJanelaAtual] : [centroJanelaAtual + d, centroJanelaAtual - d];
      for (const idx of pares) {
        const slot = slotsObras[idx];
        if (slot && slot.estado === 'vazio') {
          candidatos.push(slot);
        }
      }
    }

    for (const slot of candidatos) {
      if (carregamentosAtivos >= CONFIG.maxCarregamentosSimultaneos) break;
      carregarSlot(slot);
    }
  }

  function carregarSlot(slot) {
    slot.estado = 'carregando';
    carregamentosAtivos++;
    const inicioMs = performance.now();

    carregadorTextura.load(
      slot.obra.urlMini,
      (textura) => {
        carregamentosAtivos--;
        temposCarregamentoMs.push(performance.now() - inicioMs);

        if (Math.abs(slot.indice - centroJanelaAtual) > CONFIG.raioDescarte) {
          textura.dispose();
          slot.estado = 'vazio';
          processarFilaCarregamento();
          return;
        }

        textura.colorSpace = THREE.SRGBColorSpace;
        textura.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const img = textura.image;
        const proporcao = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 3 / 4;
        slot.aplicarProporcao(proporcao);

        // Preservado: MeshBasicMaterial com toneMapped: false para fidelidade de cor
        const mat = new THREE.MeshBasicMaterial({
          map: textura,
          toneMapped: false
        });
        slot.textura = textura;
        slot.material = mat;
        slot.fotoMesh.material = mat;
        slot.estado = 'carregado';

        solicitarRender();
        processarFilaCarregamento();
      },
      undefined,
      () => {
        carregamentosAtivos--;
        registrarAviso(`Miniatura não encontrada: ${slot.obra.urlMini} (${slot.obra.nome}).`);
        const texErro = criarTexturaErroImagem(slot.obra);
        const matErro = new THREE.MeshBasicMaterial({ map: texErro, toneMapped: false });
        slot.textura = texErro;
        slot.material = matErro;
        slot.fotoMesh.material = matErro;
        slot.estado = 'erro';

        solicitarRender();
        processarFilaCarregamento();
      }
    );
  }

  function atualizarJanelaTexturas(indiceCentro) {
    centroJanelaAtual = THREE.MathUtils.clamp(Math.round(indiceCentro), 0, OBRAS.length - 1);
    atualizarPoolRefletores(centroJanelaAtual);
    processarFilaCarregamento();
  }

  /* ── Cálculo dos Pontos de Observação (compensando o HUD) ── */
  function recalcularPontosEPercursos() {
    if (topbar) {
      document.documentElement.style.setProperty('--topbar-h', `${topbar.getBoundingClientRect().height}px`);
    }

    const ehMobile = window.matchMedia('(max-width: 820px)').matches;
    const distancia = ehMobile ? CONFIG.distanciaObservacaoMobile : CONFIG.distanciaObservacaoDesktop;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const meiaAlturaVisivel = distancia * Math.tan(fovRad / 2);
    const meiaLarguraVisivel = meiaAlturaVisivel * camera.aspect;

    let offsetLateral = 0;
    let offsetVertical = 0;

    if (!ehMobile) {
      const rectHud = hud.getBoundingClientRect();
      if (rectHud.width > 0) {
        const espacoDireito = rectHud.width + 24;
        const fracaoOcupada = Math.min(espacoDireito / window.innerWidth, 0.34);
        offsetLateral = meiaLarguraVisivel * fracaoOcupada * 0.92;
      }
    } else {
      const topoLivre = hudInfo ? hudInfo.getBoundingClientRect().bottom : 112;
      const baseLivre = hudControles ? hudControles.getBoundingClientRect().top : window.innerHeight - 72;
      const centroLivreY = (topoLivre + baseLivre) * 0.5;
      const deslocamentoNormY = (centroLivreY / window.innerHeight) - 0.5;
      offsetVertical = meiaAlturaVisivel * 2 * deslocamentoNormY;
    }

    OBRAS.forEach((obra, i) => {
      const dirFrontal = new THREE.Vector3(
        Math.sin(obra.posicao.rotY),
        0,
        Math.cos(obra.posicao.rotY)
      ).normalize();

      const dirOlhar = dirFrontal.clone().negate();
      const vetorDireita = new THREE.Vector3().crossVectors(dirOlhar, EIXO_Y).normalize();

      const centroObra = new THREE.Vector3(
        obra.posicao.x + dirFrontal.x * 0.07,
        CONFIG.alturaCentroObra,
        obra.posicao.z + dirFrontal.z * 0.07
      );

      const deslocamento = vetorDireita.multiplyScalar(offsetLateral);
      deslocamento.y = offsetVertical;

      const alvo = centroObra.clone().add(deslocamento);
      const posicao = alvo.clone().addScaledVector(dirFrontal, distancia);

      pontosObservacao[i] = { posicao, alvo };
    });

    curvasCameraTrechos.length = 0;
    for (let i = 0; i < OBRAS.length - 1; i++) {
      const pInicio = pontosObservacao[i].posicao;
      const pFim = pontosObservacao[i + 1].posicao;

      const pontoControle = new THREE.Vector3(
        0,
        (pInicio.y + pFim.y) * 0.5,
        (pInicio.z + pFim.z) * 0.5
      );

      curvasCameraTrechos.push(new THREE.QuadraticBezierCurve3(pInicio, pontoControle, pFim));
    }
  }

  /* ── Posicionamento Sincronizado da Câmera e do Fio ── */
  const tempPos = new THREE.Vector3();
  const tempAlvo = new THREE.Vector3();
  const tempGuiaFio = new THREE.Vector3();

  function aplicarEstadoPercurso(progresso) {
    const ultimoIdx = OBRAS.length - 1;
    const p = THREE.MathUtils.clamp(progresso, 0, ultimoIdx);
    const seg = Math.min(Math.floor(p), ultimoIdx - 1);
    const u = p - seg;

    curvasCameraTrechos[seg].getPoint(u, tempPos);
    camera.position.copy(tempPos);

    const tFioAtual = mapearProgressoParaFio(p, true);
    if (p > estadoPercurso.progressoMaximoFio) {
      estadoPercurso.progressoMaximoFio = p;
    }
    const tVisivelFio = mapearProgressoParaFio(estadoPercurso.progressoMaximoFio, true);
    atualizarGeometriaFio(tVisivelFio, tFioAtual);

    tempAlvo.lerpVectors(pontosObservacao[seg].alvo, pontosObservacao[seg + 1].alvo, u);
    const pesoGuia = Math.sin(u * Math.PI) * 0.62;
    if (pesoGuia > 0.001) {
      curvaFio.getPointAt(tFioAtual, tempGuiaFio);
      tempGuiaFio.y = 0.28;
      tempAlvo.lerp(tempGuiaFio, pesoGuia);
    }
    camera.lookAt(tempAlvo);

    atualizarJanelaTexturas(p);
  }

  /* ── HUD e Navegação Guiada ── */
  function atualizarHUD() {
    const obra = OBRAS[indiceAtual];
    hudNumero.textContent = `ARCANO ${obra.romano}`;
    hudNome.textContent = obra.nome;
    hudProgresso.textContent = `Obra ${indiceAtual + 1} de ${OBRAS.length}`;

    btnAnterior.disabled = indiceAtual === 0;
    btnProximo.disabled = indiceAtual === OBRAS.length - 1;

    if (btnInicio) {
      btnInicio.hidden = indiceAtual !== OBRAS.length - 1;
    }
  }

  function iniciarDeslocamentoPara(novoIndice, instantaneo = false) {
    const alvoClamped = THREE.MathUtils.clamp(novoIndice, 0, OBRAS.length - 1);
    indiceAtual = alvoClamped;
    atualizarHUD();

    if (instantaneo || prefersReducedMotion) {
      interromperPercurso(true);
      estadoPercurso.progressoAtual = alvoClamped;
      aplicarEstadoPercurso(alvoClamped);
      solicitarRender();
      return;
    }

    const distanciaProgresso = Math.abs(alvoClamped - estadoPercurso.progressoAtual);
    if (distanciaProgresso < 0.001) {
      interromperPercurso(false);
      aplicarEstadoPercurso(alvoClamped);
      solicitarRender();
      return;
    }

    estadoPercurso.progressoInicio = estadoPercurso.progressoAtual;
    estadoPercurso.progressoDestino = alvoClamped;
    estadoPercurso.duracaoMs = Math.max(600, distanciaProgresso * CONFIG.duracaoTrecho * 1000);
    estadoPercurso.inicioTempo = performance.now();
    estadoPercurso.ativo = true;

    gerenciadorAudio.iniciarMovimento();
    solicitarRender();
  }

  function voltarAoInicio() {
    interromperPercurso(true);
    estadoPercurso.progressoMaximoFio = 0;
    estadoPercurso.progressoAtual = 0;
    iniciarDeslocamentoPara(0, true);
  }

  // Inicializa diante de 0 — O Louco (sem reproduzir áudio)
  recalcularPontosEPercursos();
  iniciarDeslocamentoPara(0, true);

  /* ── Eventos de Controle ── */
  btnAnterior.addEventListener('click', () => {
    if (btnAnterior.disabled) return;
    const base = estadoPercurso.ativo ? Math.ceil(estadoPercurso.progressoAtual) : indiceAtual;
    if (base > 0) {
      gerenciadorAudio.tocarClique();
      iniciarDeslocamentoPara(base - 1);
    }
  });

  btnProximo.addEventListener('click', () => {
    if (btnProximo.disabled) return;
    const base = estadoPercurso.ativo ? Math.floor(estadoPercurso.progressoAtual) : indiceAtual;
    if (base < OBRAS.length - 1) {
      gerenciadorAudio.tocarClique();
      iniciarDeslocamentoPara(base + 1);
    }
  });

  btnVerObra.addEventListener('click', () => abrirModal(indiceAtual));

  if (btnInicio) {
    btnInicio.addEventListener('click', () => {
      gerenciadorAudio.tocarClique();
      voltarAoInicio();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (modal.open) return;
    if (e.key === 'ArrowLeft' && !btnAnterior.disabled) {
      e.preventDefault();
      gerenciadorAudio.tocarClique();
      iniciarDeslocamentoPara(indiceAtual - 1);
    } else if (e.key === 'ArrowRight' && !btnProximo.disabled) {
      e.preventDefault();
      gerenciadorAudio.tocarClique();
      iniciarDeslocamentoPara(indiceAtual + 1);
    } else if (e.key === 'Enter' && document.activeElement === document.body) {
      abrirModal(indiceAtual);
    }
  });

  /* ── Seleção por Clique / Toque no Bordado (Raycaster) ── */
  const raycaster = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let inicioToque = { x: 0, y: 0 };

  function obterObraSobPonteiro(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ponteiro.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ponteiro.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(ponteiro, camera);
    const intersecoes = raycaster.intersectObjects(obrasInterativas, false);
    return intersecoes.length > 0 ? intersecoes[0].object : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    inicioToque = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    const dist = Math.hypot(e.clientX - inicioToque.x, e.clientY - inicioToque.y);
    if (dist > 8) return;

    const objeto = obterObraSobPonteiro(e.clientX, e.clientY);
    if (objeto && typeof objeto.userData.indiceArcano === 'number') {
      const idx = objeto.userData.indiceArcano;
      indiceAtual = idx;
      atualizarHUD();
      abrirModal(idx);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (modal.open) {
      canvas.style.cursor = 'default';
      return;
    }
    const objeto = obterObraSobPonteiro(e.clientX, e.clientY);
    canvas.style.cursor = objeto ? 'pointer' : 'default';
  });

  /* ── Redimensionamento Responsivo ── */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    aplicarResolucao();
    recalcularPontosEPercursos();
    aplicarEstadoPercurso(estadoPercurso.progressoAtual);
    solicitarRender();
  });

  /* ── Instrumentação de Diagnóstico (?debug=1 ou window.salaDiagnostico()) ── */
  let painelDebug = null;
  if (modoDebug) {
    painelDebug = document.createElement('pre');
    painelDebug.style.cssText =
      'position:fixed;bottom:1rem;left:1rem;z-index:30;padding:.5rem .75rem;' +
      'background:rgba(28,24,19,.84);color:#F4EFE6;font:11px/1.4 monospace;' +
      'border:1px solid #A07830;border-radius:3px;pointer-events:none;';
    document.body.appendChild(painelDebug);
  }

  function obterDiagnostico() {
    const mediaMs = temposCarregamentoMs.length
      ? Math.round(temposCarregamentoMs.reduce((a, b) => a + b, 0) / temposCarregamentoMs.length)
      : 0;
    return {
      obraAtual: `${OBRAS[indiceAtual].romano} — ${OBRAS[indiceAtual].nome} (${indiceAtual + 1}/${OBRAS.length})`,
      texturasEmMemoria: renderer.info.memory.textures,
      geometriasEmMemoria: renderer.info.memory.geometries,
      drawCallsPorQuadro: renderer.info.render.calls,
      totalRendersExecutados: totalRenders,
      slotsCarregados: slotsObras.filter((s) => s.estado === 'carregado').length,
      tempoMedioCargaMs: mediaMs
    };
  }

  window.salaDiagnostico = obterDiagnostico;

  function atualizarPainelDebug() {
    if (!painelDebug) return;
    const d = obterDiagnostico();
    painelDebug.textContent =
      `Texturas VRAM: ${d.texturasEmMemoria} (slots: ${d.slotsCarregados}/22)\n` +
      `Geometrias: ${d.geometriasEmMemoria} | Draw calls: ${d.drawCallsPorQuadro}\n` +
      `Renders: ${d.totalRendersExecutados} | Carga média: ${d.tempoMedioCargaMs} ms`;
  }

  /* ── Loop de Renderização Sob Demanda ── */
  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function executarQuadro(agora) {
    rafId = null;

    if (estadoPercurso.ativo) {
      const decorrido = (agora - estadoPercurso.inicioTempo) / estadoPercurso.duracaoMs;
      const frac = Math.min(decorrido, 1);
      const fator = easeInOutSine(frac);

      estadoPercurso.progressoAtual = THREE.MathUtils.lerp(
        estadoPercurso.progressoInicio,
        estadoPercurso.progressoDestino,
        fator
      );

      aplicarEstadoPercurso(estadoPercurso.progressoAtual);

      if (frac >= 1) {
        estadoPercurso.ativo = false;
        gerenciadorAudio.pararMovimento(false);
      }
    }

    renderer.render(cena, camera);
    totalRenders++;
    atualizarPainelDebug();

    if (estadoPercurso.ativo && !abaOculta) {
      rafId = requestAnimationFrame(executarQuadro);
    }
  }

  solicitarRender();
}

/* =====================================================
   INICIALIZAÇÃO
   ===================================================== */
if (verificarWebGL()) {
  iniciarCena3D();
} else {
  ativarFallbackSemWebGL();
}