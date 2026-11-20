import * as THREE from 'three';

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

  // Altura do centro da obra em relação ao piso
  alturaCentroObra: 1.50,

  // Distância frontal diante de cada bordado
  distanciaObservacaoDesktop: 2.18,
  distanciaObservacaoMobile: 2.55,

  // Duração do deslocamento suave entre uma obra e a próxima (segundos)
  duracaoTrecho: 2.1,

  // Resolução do tubo do fio dourado para extensão orgânica contínua
  segmentosTubularesFio: 420,
  segmentosRadiaisFio: 10,
  raioFio: 0.015
};

/* =====================================================
   DADOS DO PROTÓTIPO (3 Arcanos)
   Textos e caminhos preservados do site original
   ===================================================== */
const ARCANOS_PROTOTIPO = [
  {
    n: 3,
    romano: 'III',
    nome: 'A Imperatriz',
    imagem: '/img/arcanos/03-a-imperatriz.webp',
    frase: 'A criação que floresce quando é cuidada.',
    pergunta: 'O que em você pede para nascer?',
    posicao: { x: -1.85, z: -1.2, rotY: Math.PI * 0.22 }
  },
  {
    n: 13,
    romano: 'XIII',
    nome: 'A Morte',
    imagem: '/img/arcanos/13-a-morte.webp',
    frase: 'O que termina abre espaço para o que vem.',
    pergunta: 'O que já cumpriu o seu tempo?',
    posicao: { x: 1.85, z: -5.2, rotY: -Math.PI * 0.22 }
  },
  {
    n: 19,
    romano: 'XIX',
    nome: 'O Sol',
    imagem: '/img/arcanos/19-o-sol.webp',
    frase: 'A clareza, a alegria e a vida à luz do dia.',
    pergunta: 'O que merece ser celebrado agora?',
    posicao: { x: -1.85, z: -9.2, rotY: Math.PI * 0.22 }
  }
];

/* =====================================================
   ELEMENTOS DE INTERFACE
   ===================================================== */
const canvas         = document.getElementById('sala-canvas');
const hud            = document.getElementById('sala-hud');
const hudNumero      = document.getElementById('hud-numero');
const hudNome        = document.getElementById('hud-nome');
const hudProgresso   = document.getElementById('hud-progresso');
const btnAnterior    = document.getElementById('btn-anterior');
const btnProximo     = document.getElementById('btn-proximo');
const btnVerObra     = document.getElementById('btn-ver-obra');
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
const EIXO_Y = new THREE.Vector3(0, 1, 0);

/* =====================================================
   ESTADO DA APLICAÇÃO
   ===================================================== */
let indiceAtual = 0;
const obrasInterativas = [];
const pontosObservacao = [];
const curvasCameraTrechos = [];

// Estado sincronizado da câmera e do fio dourado
// progressoAtual varia continuamente de 0 (Obra 1) até ARCANOS_PROTOTIPO.length - 1 (última obra)
const estadoPercurso = {
  ativo: false,
  progressoAtual: 0,
  progressoInicio: 0,
  progressoDestino: 0,
  progressoMaximoFio: 0, // Mantém visível todo o trecho já percorrido
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

function registrarAviso(mensagem) {
  avisosEl.hidden = false;
  const p = document.createElement('p');
  p.textContent = mensagem;
  avisosEl.appendChild(p);
  console.warn('[Sala Virtual]', mensagem);
}

function ativarFallbackSemWebGL() {
  canvas.style.display = 'none';
  hud.hidden = true;
  fallbackEl.hidden = false;

  ARCANOS_PROTOTIPO.forEach((arcano, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fallback-item';

    const img = document.createElement('img');
    img.src = arcano.imagem;
    img.alt = `Bordado do Arcano ${arcano.nome}`;
    img.addEventListener('error', () => {
      img.remove();
      const erro = document.createElement('div');
      erro.className = 'modal-erro-foto';
      erro.textContent = `Imagem não encontrada: ${arcano.imagem}`;
      btn.prepend(erro);
    });

    const legenda = document.createElement('span');
    legenda.className = 'fallback-item-legenda';
    legenda.innerHTML = `<strong>${arcano.romano}</strong>${arcano.nome}`;

    btn.append(img, legenda);
    btn.addEventListener('click', () => abrirModal(i));
    fallbackGrid.appendChild(btn);
  });
}

/* =====================================================
   MODAL ACESSÍVEL
   ===================================================== */
function interromperPercurso() {
  estadoPercurso.ativo = false;
}

function abrirModal(indice) {
  // Interrompe imediatamente tanto a câmera quanto o avanço do fio
  interromperPercurso();

  const arcano = ARCANOS_PROTOTIPO[indice];
  if (!arcano) return;

  modalFoto.innerHTML = '';
  const img = document.createElement('img');
  img.src = arcano.imagem;
  img.alt = `Bordado do Arcano ${arcano.nome}, ampliado`;

  img.addEventListener('error', () => {
    img.remove();
    const erro = document.createElement('div');
    erro.className = 'modal-erro-foto';
    erro.textContent = `Não foi possível carregar a fotografia original em "${arcano.imagem}". Verifique se o arquivo existe nesta pasta.`;
    modalFoto.appendChild(erro);
  });

  modalFoto.appendChild(img);
  modalNumero.textContent = `ARCANO ${arcano.romano}`;
  modalNome.textContent = arcano.nome;
  modalFrase.textContent = arcano.frase;
  modalPergunta.textContent = arcano.pergunta;

  if (!modal.open) {
    modal.showModal();
  }
}

function fecharModal() {
  if (modal.open) {
    modal.close();
  }
  // Permanece parado até uma nova ação explícita do visitante
}

modalFechar.addEventListener('click', fecharModal);
modalFecharBtn.addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) fecharModal();
});

/* =====================================================
   TEXTURAS PROCEDURAIS (Piso sépia suave e aviso de erro)
   ===================================================== */
function criarTexturaPisoMadeira() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#B89E82';
  ctx.fillRect(0, 0, 512, 512);

  const tabuas = 8;
  const largTabua = 512 / tabuas;
  for (let i = 0; i < tabuas; i++) {
    const tom = i % 2 === 0 ? 'rgba(130, 102, 74, 0.12)' : 'rgba(244, 239, 230, 0.08)';
    ctx.fillStyle = tom;
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
  tex.repeat.set(5, 10);
  return tex;
}

function criarTexturaErroImagem(arcano) {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 800;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#231F1A';
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.strokeStyle = '#C49A50';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, c.width - 48, c.height - 48);

  ctx.fillStyle = '#E8D9B8';
  ctx.font = '600 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ARCANO ${arcano.romano}`, c.width / 2, 260);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '34px Georgia, serif';
  ctx.fillText(arcano.nome, c.width / 2, 325);

  ctx.fillStyle = '#C49A50';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Fotografia não encontrada:', c.width / 2, 430);
  ctx.fillStyle = '#F4EFE6';
  ctx.font = '20px monospace';
  ctx.fillText(arcano.imagem, c.width / 2, 470);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* =====================================================
   CONSTRUÇÃO DA GALERIA 3D
   ===================================================== */
function iniciarCena3D() {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0xEDE6D8);
  cena.fog = new THREE.Fog(0xEDE6D8, 12, 24);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    40
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

  /* ── Iluminação geral suave ── */
  const luzAmbiente = new THREE.AmbientLight(0xFFF8EE, 1.15);
  cena.add(luzAmbiente);

  const luzHemisferica = new THREE.HemisphereLight(0xFFFDF8, 0xC6B59E, 0.75);
  luzHemisferica.position.set(0, 4, 0);
  cena.add(luzHemisferica);

  /* ── Arquitetura da Sala ── */
  const larguraSala = 7.6;
  const alturaSala = 4.0;
  const comprimentoSala = 16.0;
  const centroZ = -4.0; // Vai de z = +4.0 (entrada) até z = -12.0 (fundo)

  const pisoMat = new THREE.MeshStandardMaterial({
    map: criarTexturaPisoMadeira(),
    roughness: 0.78,
    metalness: 0.04
  });
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(larguraSala, comprimentoSala), pisoMat);
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, centroZ);
  cena.add(piso);

  const tetoMat = new THREE.MeshStandardMaterial({
    color: 0xF7F3EC,
    roughness: 0.95
  });
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(larguraSala, comprimentoSala), tetoMat);
  teto.rotation.x = Math.PI / 2;
  teto.position.set(0, alturaSala, centroZ);
  cena.add(teto);

  const paredeMat = new THREE.MeshStandardMaterial({
    color: 0xF4EFE6,
    roughness: 0.92
  });

  const paredeEsq = new THREE.Mesh(new THREE.PlaneGeometry(comprimentoSala, alturaSala), paredeMat);
  paredeEsq.rotation.y = Math.PI / 2;
  paredeEsq.position.set(-larguraSala / 2, alturaSala / 2, centroZ);
  cena.add(paredeEsq);

  const paredeDir = new THREE.Mesh(new THREE.PlaneGeometry(comprimentoSala, alturaSala), paredeMat);
  paredeDir.rotation.y = -Math.PI / 2;
  paredeDir.position.set(larguraSala / 2, alturaSala / 2, centroZ);
  cena.add(paredeDir);

  const paredeFundo = new THREE.Mesh(new THREE.PlaneGeometry(larguraSala, alturaSala), paredeMat);
  paredeFundo.position.set(0, alturaSala / 2, centroZ - comprimentoSala / 2);
  cena.add(paredeFundo);

  const paredeEntrada = new THREE.Mesh(new THREE.PlaneGeometry(larguraSala, alturaSala), paredeMat);
  paredeEntrada.rotation.y = Math.PI;
  paredeEntrada.position.set(0, alturaSala / 2, centroZ + comprimentoSala / 2);
  cena.add(paredeEntrada);

  const rodapeMat = new THREE.MeshStandardMaterial({ color: 0xDDD5C5, roughness: 0.85 });
  const rodapeEsq = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, comprimentoSala), rodapeMat);
  rodapeEsq.position.set(-larguraSala / 2 + 0.03, 0.07, centroZ);
  cena.add(rodapeEsq);

  const rodapeDir = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, comprimentoSala), rodapeMat);
  rodapeDir.position.set(larguraSala / 2 - 0.03, 0.07, centroZ);
  cena.add(rodapeDir);

  const rodapeFundo = new THREE.Mesh(new THREE.BoxGeometry(larguraSala, 0.14, 0.06), rodapeMat);
  rodapeFundo.position.set(0, 0.07, centroZ - comprimentoSala / 2 + 0.03);
  cena.add(rodapeFundo);

  /* ── Fio Dourado Dinâmico no Piso ── */
  // Traçado orgânico que nasce próximo à entrada e conduz até diante de cada obra
  const pontosChaoFio = [
    new THREE.Vector3(0.05,  0.015,  3.55), // Entrada da sala
    new THREE.Vector3(-0.32, 0.015,  2.15),
    new THREE.Vector3(-0.52, 0.015,  0.55), // Diante de A Imperatriz (parada 0)
    new THREE.Vector3(0.12,  0.015, -1.55), // Curva orgânica central
    new THREE.Vector3(0.54,  0.015, -3.55), // Diante de A Morte (parada 1)
    new THREE.Vector3(-0.12, 0.015, -5.65), // Curva orgânica central
    new THREE.Vector3(-0.52, 0.015, -7.55)  // Diante de O Sol (parada 2)
  ];

  const curvaFio = new THREE.CatmullRomCurve3(pontosChaoFio, false, 'catmullrom', 0.5);

  const fioGeo = new THREE.TubeGeometry(
    curvaFio,
    CONFIG.segmentosTubularesFio,
    CONFIG.raioFio,
    CONFIG.segmentosRadiaisFio,
    false
  );

  const fioMat = new THREE.MeshStandardMaterial({
    color: 0xC49A50,
    metalness: 0.72,
    roughness: 0.28,
    emissive: 0x3D2A09,
    emissiveIntensity: 0.24
  });

  const fioDourado = new THREE.Mesh(fioGeo, fioMat);
  cena.add(fioDourado);

  // Extremidade arredondada e delicada na ponta atual do fio
  const pontaFio = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.raioFio * 1.12, 12, 12),
    fioMat
  );
  cena.add(pontaFio);

  // Calcula o parâmetro exato (0..1) na curva do fio para cada uma das 3 paradas
  const alvosChaoParadas = [
    pontosChaoFio[2], // A Imperatriz
    pontosChaoFio[4], // A Morte
    pontosChaoFio[6]  // O Sol
  ];

  const tParadasFio = alvosChaoParadas.map((alvo) => {
    let melhorT = 0;
    let menorDist = Infinity;
    const amostras = 1000;
    for (let i = 0; i <= amostras; i++) {
      const t = i / amostras;
      const dist = curvaFio.getPointAt(t).distanceToSquared(alvo);
      if (dist < menorDist) {
        menorDist = dist;
        melhorT = t;
      }
    }
    return melhorT;
  });

  function mapearProgressoParaFio(progresso) {
    const ultimoIdx = ARCANOS_PROTOTIPO.length - 1;
    const p = THREE.MathUtils.clamp(progresso, 0, ultimoIdx);
    const seg = Math.min(Math.floor(p), ultimoIdx - 1);
    const u = p - seg;
    return THREE.MathUtils.lerp(tParadasFio[seg], tParadasFio[seg + 1], u);
  }

  function atualizarGeometriaFio(tVisivel) {
    const tLimitado = THREE.MathUtils.clamp(tVisivel, 0.002, 1);
    const segsVisiveis = Math.max(
      1,
      Math.round(tLimitado * CONFIG.segmentosTubularesFio)
    );
    const indicesPorSegmento = CONFIG.segmentosRadiaisFio * 6;
    fioGeo.setDrawRange(0, segsVisiveis * indicesPorSegmento);

    const pontoPonta = curvaFio.getPointAt(tLimitado);
    pontaFio.position.copy(pontoPonta);
  }

  /* ── Materiais dos Cavaletes e Molduras ── */
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

  const carregadorTextura = new THREE.TextureLoader();

  /* ── Construção dos 3 Cavaletes e Molduras ── */
  function construirCavaleteComObra(arcano, indice) {
    const grupo = new THREE.Group();
    grupo.position.set(arcano.posicao.x, 0, arcano.posicao.z);
    grupo.rotation.y = arcano.posicao.rotY;

    const pernaGeo = new THREE.BoxGeometry(0.055, 2.08, 0.055);
    const pernaEsq = new THREE.Mesh(pernaGeo, madeiraMat);
    pernaEsq.position.set(-0.34, 1.02, 0.02);
    pernaEsq.rotation.z = -0.07;
    pernaEsq.rotation.x = -0.06;
    grupo.add(pernaEsq);

    const pernaDir = new THREE.Mesh(pernaGeo, madeiraMat);
    pernaDir.position.set(0.34, 1.02, 0.02);
    pernaDir.rotation.z = 0.07;
    pernaDir.rotation.x = -0.06;
    grupo.add(pernaDir);

    const pernaTras = new THREE.Mesh(new THREE.BoxGeometry(0.055, 2.15, 0.055), madeiraMat);
    pernaTras.position.set(0, 0.98, -0.42);
    pernaTras.rotation.x = 0.34;
    grupo.add(pernaTras);

    const hasteCentral = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.85, 0.045), madeiraMat);
    hasteCentral.position.set(0, 1.12, -0.02);
    hasteCentral.rotation.x = -0.06;
    grupo.add(hasteCentral);

    const prateleira = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.045, 0.14), madeiraMat);
    prateleira.position.set(0, 0.86, 0.09);
    grupo.add(prateleira);

    const grupoQuadro = new THREE.Group();
    grupoQuadro.position.set(0, CONFIG.alturaCentroObra, 0.07);
    grupo.add(grupoQuadro);

    function montarQuadro(textura, proporcaoLarguraAltura) {
      while (grupoQuadro.children.length > 0) {
        const filho = grupoQuadro.children[0];
        if (filho.geometry) filho.geometry.dispose();
        grupoQuadro.remove(filho);
      }

      let largura = CONFIG.larguraMaxObra;
      let altura = largura / proporcaoLarguraAltura;
      if (altura > CONFIG.alturaMaxObra) {
        altura = CONFIG.alturaMaxObra;
        largura = altura * proporcaoLarguraAltura;
      }

      const espessuraMoldura = largura * CONFIG.fatorEspessuraMoldura;
      const profundidade = CONFIG.profundidadeMoldura;
      prateleira.position.y = CONFIG.alturaCentroObra - (altura / 2) - espessuraMoldura - 0.025;

      const fundoGeo = new THREE.BoxGeometry(
        largura + espessuraMoldura * 2,
        altura + espessuraMoldura * 2,
        0.016
      );
      const fundo = new THREE.Mesh(fundoGeo, molduraPretaMat);
      fundo.position.z = -profundidade / 2;
      grupoQuadro.add(fundo);

      const barraHorizGeo = new THREE.BoxGeometry(
        largura + espessuraMoldura * 2,
        espessuraMoldura,
        profundidade
      );
      const barraVertGeo = new THREE.BoxGeometry(
        espessuraMoldura,
        altura,
        profundidade
      );

      const topo = new THREE.Mesh(barraHorizGeo, molduraPretaMat);
      topo.position.y = altura / 2 + espessuraMoldura / 2;
      grupoQuadro.add(topo);

      const base = new THREE.Mesh(barraHorizGeo, molduraPretaMat);
      base.position.y = -(altura / 2 + espessuraMoldura / 2);
      grupoQuadro.add(base);

      const esq = new THREE.Mesh(barraVertGeo, molduraPretaMat);
      esq.position.x = -(largura / 2 + espessuraMoldura / 2);
      grupoQuadro.add(esq);

      const dir = new THREE.Mesh(barraVertGeo, molduraPretaMat);
      dir.position.x = largura / 2 + espessuraMoldura / 2;
      grupoQuadro.add(dir);

      // Fotografia original sem alteração de cor pela iluminação
      const fotoGeo = new THREE.PlaneGeometry(largura, altura);
      const fotoMat = new THREE.MeshBasicMaterial({
        map: textura,
        toneMapped: false
      });
      const fotoMesh = new THREE.Mesh(fotoGeo, fotoMat);
      fotoMesh.position.z = 0.004;
      fotoMesh.userData.indiceArcano = indice;
      grupoQuadro.add(fotoMesh);

      obrasInterativas[indice] = fotoMesh;
    }

    carregadorTextura.load(
      arcano.imagem,
      (textura) => {
        textura.colorSpace = THREE.SRGBColorSpace;
        textura.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const img = textura.image;
        const proporcao = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 3 / 4;
        montarQuadro(textura, proporcao);
      },
      undefined,
      () => {
        registrarAviso(`Imagem não encontrada: ${arcano.imagem} (${arcano.nome}).`);
        montarQuadro(criarTexturaErroImagem(arcano), 3 / 4);
      }
    );

    const spot = new THREE.SpotLight(0xFFF6E8, 9, 7.5, Math.PI / 4.2, 0.75, 1.5);
    const dirFrontal = new THREE.Vector3(Math.sin(arcano.posicao.rotY), 0, Math.cos(arcano.posicao.rotY));
    spot.position.set(
      arcano.posicao.x + dirFrontal.x * 1.15,
      3.55,
      arcano.posicao.z + dirFrontal.z * 1.15
    );
    spot.target.position.set(arcano.posicao.x, CONFIG.alturaCentroObra, arcano.posicao.z);
    cena.add(spot, spot.target);

    cena.add(grupo);
  }

  ARCANOS_PROTOTIPO.forEach((arcano, i) => construirCavaleteComObra(arcano, i));

  /* ── Cálculo dos Pontos de Observação (compensando o espaço do HUD) ── */
  function recalcularPontosEPercursos() {
    const ehMobile = window.matchMedia('(max-width: 820px)').matches;
    const distancia = ehMobile ? CONFIG.distanciaObservacaoMobile : CONFIG.distanciaObservacaoDesktop;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const meiaAlturaVisivel = distancia * Math.tan(fovRad / 2);
    const meiaLarguraVisivel = meiaAlturaVisivel * camera.aspect;

    // Mede o painel HUD real na tela para manter a obra na área livre
    const rectHud = hud.getBoundingClientRect();
    let offsetLateral = 0;
    let offsetVertical = 0;

    if (!ehMobile && rectHud.width > 0) {
      // HUD na lateral direita: desloca o enquadramento para a direita,
      // projetando o bordado centralizado na área livre à esquerda do painel
      const espacoDireito = rectHud.width + 24;
      const fracaoOcupada = Math.min(espacoDireito / window.innerWidth, 0.34);
      offsetLateral = meiaLarguraVisivel * fracaoOcupada * 0.92;
    } else if (ehMobile && rectHud.height > 0) {
      // HUD compacto na base: eleva levemente o bordado na área livre acima do painel
      const fracaoInferior = Math.min((rectHud.height + 16) / window.innerHeight, 0.28);
      offsetVertical = -meiaAlturaVisivel * fracaoInferior * 0.65;
    }

    ARCANOS_PROTOTIPO.forEach((arcano, i) => {
      const dirFrontal = new THREE.Vector3(
        Math.sin(arcano.posicao.rotY),
        0,
        Math.cos(arcano.posicao.rotY)
      ).normalize();

      // Vetor "direita" sob o ponto de vista da câmera olhando para o bordado
      const dirOlhar = dirFrontal.clone().negate();
      const vetorDireita = new THREE.Vector3().crossVectors(dirOlhar, EIXO_Y).normalize();

      const centroObra = new THREE.Vector3(
        arcano.posicao.x + dirFrontal.x * 0.07,
        CONFIG.alturaCentroObra,
        arcano.posicao.z + dirFrontal.z * 0.07
      );

      const deslocamento = vetorDireita.multiplyScalar(offsetLateral);
      deslocamento.y = offsetVertical;

      const alvo = centroObra.clone().add(deslocamento);
      const posicao = alvo.clone().addScaledVector(dirFrontal, distancia);

      pontosObservacao[i] = { posicao, alvo };
    });

    // Cria uma curva suave para a câmera em cada trecho, acompanhando o sinuoso do fio no piso
    curvasCameraTrechos.length = 0;
    for (let i = 0; i < ARCANOS_PROTOTIPO.length - 1; i++) {
      const pInicio = pontosObservacao[i].posicao;
      const pFim = pontosObservacao[i + 1].posicao;

      const tMedioFio = (tParadasFio[i] + tParadasFio[i + 1]) * 0.5;
      const pontoFioMedio = curvaFio.getPointAt(tMedioFio);
      const pontoControle = new THREE.Vector3(
        pontoFioMedio.x,
        (pInicio.y + pFim.y) * 0.5,
        pontoFioMedio.z
      );

      curvasCameraTrechos.push(new THREE.QuadraticBezierCurve3(pInicio, pontoControle, pFim));
    }
  }

  /* ── Posicionamento Sincronizado da Câmera e do Fio ── */
  const tempPos = new THREE.Vector3();
  const tempAlvo = new THREE.Vector3();
  const tempGuiaFio = new THREE.Vector3();

  function aplicarEstadoPercurso(progresso) {
    const ultimoIdx = ARCANOS_PROTOTIPO.length - 1;
    const p = THREE.MathUtils.clamp(progresso, 0, ultimoIdx);
    const seg = Math.min(Math.floor(p), ultimoIdx - 1);
    const u = p - seg;

    // 1. Posição suave da câmera acompanhando a curva associada ao fio
    curvasCameraTrechos[seg].getPoint(u, tempPos);
    camera.position.copy(tempPos);

    // 2. Direção do olhar: nas paradas olha diretamente para a obra;
    //    no meio do trajeto acompanha suavemente a direção do fio no corredor
    tempAlvo.lerpVectors(pontosObservacao[seg].alvo, pontosObservacao[seg + 1].alvo, u);
    const tFioAtual = mapearProgressoParaFio(p);
    const pesoGuia = Math.sin(u * Math.PI) * 0.32;
    if (pesoGuia > 0.001) {
      curvaFio.getPointAt(Math.min(1, tFioAtual + 0.04), tempGuiaFio);
      tempGuiaFio.y = CONFIG.alturaCentroObra * 0.72;
      tempAlvo.lerp(tempGuiaFio, pesoGuia);
    }
    camera.lookAt(tempAlvo);

    // 3. Fio dourado: estende-se sincronizado e mantém sempre visível o trecho já percorrido
    if (p > estadoPercurso.progressoMaximoFio) {
      estadoPercurso.progressoMaximoFio = p;
    }
    const tVisivelFio = mapearProgressoParaFio(estadoPercurso.progressoMaximoFio);
    atualizarGeometriaFio(tVisivelFio);
  }

  /* ── HUD e Navegação Guiada ── */
  function atualizarHUD() {
    const arcano = ARCANOS_PROTOTIPO[indiceAtual];
    hudNumero.textContent = `ARCANO ${arcano.romano}`;
    hudNome.textContent = arcano.nome;
    hudProgresso.textContent = `Obra ${indiceAtual + 1} de ${ARCANOS_PROTOTIPO.length}`;

    btnAnterior.disabled = indiceAtual === 0;
    btnProximo.disabled = indiceAtual === ARCANOS_PROTOTIPO.length - 1;
  }

  function iniciarDeslocamentoPara(novoIndice, instantaneo = false) {
    const alvoClamped = THREE.MathUtils.clamp(novoIndice, 0, ARCANOS_PROTOTIPO.length - 1);
    indiceAtual = alvoClamped;
    atualizarHUD();

    if (instantaneo || prefersReducedMotion) {
      interromperPercurso();
      estadoPercurso.progressoAtual = alvoClamped;
      aplicarEstadoPercurso(alvoClamped);
      return;
    }

    const distanciaProgresso = Math.abs(alvoClamped - estadoPercurso.progressoAtual);
    if (distanciaProgresso < 0.001) {
      interromperPercurso();
      aplicarEstadoPercurso(alvoClamped);
      return;
    }

    estadoPercurso.progressoInicio = estadoPercurso.progressoAtual;
    estadoPercurso.progressoDestino = alvoClamped;
    estadoPercurso.duracaoMs = Math.max(550, distanciaProgresso * CONFIG.duracaoTrecho * 1000);
    estadoPercurso.inicioTempo = performance.now();
    estadoPercurso.ativo = true;
  }

  // Inicializa enquadramento diante da primeira obra com o fio traçado desde a entrada
  recalcularPontosEPercursos();
  iniciarDeslocamentoPara(0, true);

  /* ── Eventos de Controle ── */
  btnAnterior.addEventListener('click', () => {
    if (indiceAtual > 0) iniciarDeslocamentoPara(indiceAtual - 1);
  });

  btnProximo.addEventListener('click', () => {
    if (indiceAtual < ARCANOS_PROTOTIPO.length - 1) iniciarDeslocamentoPara(indiceAtual + 1);
  });

  btnVerObra.addEventListener('click', () => abrirModal(indiceAtual));

  window.addEventListener('keydown', (e) => {
    if (modal.open) return;
    if (e.key === 'ArrowLeft' && indiceAtual > 0) {
      e.preventDefault();
      iniciarDeslocamentoPara(indiceAtual - 1);
    } else if (e.key === 'ArrowRight' && indiceAtual < ARCANOS_PROTOTIPO.length - 1) {
      e.preventDefault();
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
    const alvosValidos = obrasInterativas.filter(Boolean);
    const intersecoes = raycaster.intersectObjects(alvosValidos, false);
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
  });

  /* ── Loop de Renderização ── */
  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function animar(agora) {
    requestAnimationFrame(animar);

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
      }
    }

    renderer.render(cena, camera);
  }

  requestAnimationFrame(animar);
}

/* =====================================================
   INICIALIZAÇÃO
   ===================================================== */
if (verificarWebGL()) {
  iniciarCena3D();
} else {
  ativarFallbackSemWebGL();
}