/* =====================================================
   Dados dos 22 Arcanos Maiores — O Que os Fios Revelam
   Sincronizado com /obras/o-que-os-fios-revelam/index.html
   ===================================================== */

export const BASE_IMG = '/img/arcanos/';

export const ARCANOS = [
  {
    n: 0, romano: '0', nome: 'O Louco', arquivo: '00-o-louco',
    frase: 'O primeiro passo, dado antes de saber aonde leva.',
    pergunta: 'O que você deixaria para trás para começar?'
  },
  {
    n: 1, romano: 'I', nome: 'O Mago', arquivo: '01-o-mago',
    frase: 'Tudo o que é preciso já está sobre a mesa.',
    pergunta: 'Que talento seu está esperando ser usado?'
  },
  {
    n: 2, romano: 'II', nome: 'A Sacerdotisa', arquivo: '02-a-sacerdotisa',
    frase: 'O saber que cresce no silêncio.',
    pergunta: 'O que você já sabe, mas ainda não disse a si mesma?'
  },
  {
    n: 3, romano: 'III', nome: 'A Imperatriz', arquivo: '03-a-imperatriz',
    frase: 'A criação que floresce quando é cuidada.',
    pergunta: 'O que em você pede para nascer?'
  },
  {
    n: 4, romano: 'IV', nome: 'O Imperador', arquivo: '04-o-imperador',
    frase: 'Estrutura, firmeza e a ordem que sustenta.',
    pergunta: 'Onde falta um limite claro?'
  },
  {
    n: 5, romano: 'V', nome: 'O Hierofante', arquivo: '05-o-hierofante',
    frase: 'A tradição como ponte entre o humano e o sagrado.',
    pergunta: 'Que ensinamento você carrega de quem veio antes?'
  },
  {
    n: 6, romano: 'VI', nome: 'Os Enamorados', arquivo: '06-os-enamorados',
    frase: 'Todo caminho começa em uma escolha.',
    pergunta: 'O que o seu coração já escolheu?'
  },
  {
    n: 7, romano: 'VII', nome: 'O Carro', arquivo: '07-o-carro',
    frase: 'Vontade e direção avançando juntas.',
    pergunta: 'Para onde você está guiando a sua energia?'
  },
  {
    n: 8, romano: 'VIII', nome: 'A Força', arquivo: '08-a-forca',
    frase: 'A coragem que é gentil e por isso permanece.',
    pergunta: 'Onde a delicadeza pode mais do que a pressa?'
  },
  {
    n: 9, romano: 'IX', nome: 'O Eremita', arquivo: '09-o-eremita',
    frase: 'A lanterna acesa no caminho interior.',
    pergunta: 'Que resposta só aparece quando você silencia?'
  },
  {
    n: 10, romano: 'X', nome: 'A Roda da Fortuna', arquivo: '10-a-roda-da-fortuna',
    frase: 'Os ciclos giram, e com eles tudo se renova.',
    pergunta: 'O que está mudando e pede a sua aceitação?'
  },
  {
    n: 11, romano: 'XI', nome: 'A Justiça', arquivo: '11-a-justica',
    frase: 'O equilíbrio de quem olha os fatos com clareza.',
    pergunta: 'O que precisa ser pesado com honestidade?'
  },
  {
    n: 12, romano: 'XII', nome: 'O Enforcado', arquivo: '12-o-enforcado',
    frase: 'Ver de cabeça para baixo é ver de outro jeito.',
    pergunta: 'Que ponto de vista você ainda não experimentou?'
  },
  {
    n: 13, romano: 'XIII', nome: 'A Morte', arquivo: '13-a-morte',
    frase: 'O que termina abre espaço para o que vem.',
    pergunta: 'O que já cumpriu o seu tempo?'
  },
  {
    n: 14, romano: 'XIV', nome: 'A Temperança', arquivo: '14-a-temperanca',
    frase: 'A paciência de misturar na medida certa.',
    pergunta: 'Que elementos da sua vida pedem harmonia?'
  },
  {
    n: 15, romano: 'XV', nome: 'O Diabo', arquivo: '15-o-diabo',
    frase: 'As correntes que a gente não vê, mas carrega.',
    pergunta: 'O que prende você e é possível soltar?'
  },
  {
    n: 16, romano: 'XVI', nome: 'A Torre', arquivo: '16-a-torre',
    frase: 'O que era falso cai para que a verdade apareça.',
    pergunta: 'Que estrutura já não se sustenta?'
  },
  {
    n: 17, romano: 'XVII', nome: 'A Estrela', arquivo: '17-a-estrela',
    frase: 'A esperança depois da tempestade.',
    pergunta: 'O que ainda brilha, mesmo de longe?'
  },
  {
    n: 18, romano: 'XVIII', nome: 'A Lua', arquivo: '18-a-lua',
    frase: 'O território das sombras, dos sonhos e das dúvidas.',
    pergunta: 'O que você sente, mas ainda não entende?'
  },
  {
    n: 19, romano: 'XIX', nome: 'O Sol', arquivo: '19-o-sol',
    frase: 'A clareza, a alegria e a vida à luz do dia.',
    pergunta: 'O que merece ser celebrado agora?'
  },
  {
    n: 20, romano: 'XX', nome: 'O Julgamento', arquivo: '20-o-julgamento',
    frase: 'O chamado que desperta e convida a renascer.',
    pergunta: 'Que chamado você tem ouvido ultimamente?'
  },
  {
    n: 21, romano: 'XXI', nome: 'O Mundo', arquivo: '21-o-mundo',
    frase: 'A volta completa: o fim que também é começo.',
    pergunta: 'O que você já concluiu e merece reconhecer?'
  }
];

export function urlMiniatura(arcano) {
  return `${BASE_IMG}${arcano.arquivo}-mini.webp`;
}

export function urlGrande(arcano) {
  return `${BASE_IMG}${arcano.arquivo}.webp`;
}