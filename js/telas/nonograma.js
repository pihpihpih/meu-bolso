// Camada de APRESENTAÇÃO — tela "Jogo": um nonograma cujo desenho final é o símbolo π.
// Primeira tela separada do app.js: ela monta o próprio HTML e guarda o próprio estado.
// O progresso fica salvo só neste aparelho (localStorage), como o tema.

// Desenho da resposta (X = pintado). Conferido com um resolvedor: dá para chegar
// nele só com as dicas, sem chutar, então a solução é única.
const DESENHO = [
  '.XXXXXXXXX',
  'XXXXXXXXX.',
  'X..XX.XX..',
  '...XX.XX..',
  '...XX.XX..',
  '...XX.XX..',
  '..XX..XX..',
  '..XX..XX..',
  '.XX...XXX.',
  'XX.....XX.'
];
const N = DESENHO.length;
const RESPOSTA = DESENHO.map((r) => [...r].map((c) => (c === 'X' ? 1 : 0)));

/** Dicas de uma linha: tamanhos dos blocos pintados seguidos. [1,1,0,1] → [2,1] */
function dicas(linha) {
  const out = []; let k = 0;
  for (const v of linha) { if (v === 1) k++; else if (k) { out.push(k); k = 0; } }
  if (k) out.push(k);
  return out.length ? out : [0];
}
const coluna = (g, j) => g.map((r) => r[j]);
const DICAS_LIN = RESPOSTA.map(dicas);
const DICAS_COL = RESPOSTA[0].map((_, j) => dicas(coluna(RESPOSTA, j)));

// Estado: 0 = vazio, 1 = pintado, 2 = marcado com X (a pessoa acha que ali não vai nada).
const CHAVE = 'mb-nonograma';
const vazio = () => RESPOSTA.map((r) => r.map(() => 0));
let grade = carregar();
let modo = 'pintar';

function carregar() {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE));
    if (Array.isArray(g) && g.length === N && g.every((r) => Array.isArray(r) && r.length === N)) return g;
  } catch (e) {}
  return vazio();
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(grade)); } catch (e) {} }

const pintada = (g) => g.map((r) => r.map((v) => (v === 1 ? 1 : 0)));
/** Venceu quando os quadrados pintados são exatamente os da resposta. */
export const venceu = () => pintada(grade).every((r, i) => r.every((v, j) => v === RESPOSTA[i][j]));
const igual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Toque num quadrado: pinta/despinta (ou marca/desmarca X, no modo X). */
export function tocar(i, j) {
  if (venceu()) return;
  const alvo = modo === 'pintar' ? 1 : 2;
  grade[i][j] = grade[i][j] === alvo ? 0 : alvo;
  salvar();
}
export function trocarModo(m) { modo = m === 'marcar' ? 'marcar' : 'pintar'; }
export function recomecar() { grade = vazio(); salvar(); }

export function nonogramaHTML() {
  const ok = venceu();
  const p = pintada(grade);
  const feitoLin = DICAS_LIN.map((d, i) => igual(dicas(p[i]), d));
  const feitoCol = DICAS_COL.map((d, j) => igual(dicas(coluna(p, j)), d));

  let cel = '<div class="nono-corner"></div>';
  DICAS_COL.forEach((d, j) => {
    cel += `<div class="nono-clue col ${feitoCol[j] ? 'done' : ''}">${d.map((n) => `<span>${n}</span>`).join('')}</div>`;
  });
  RESPOSTA.forEach((_, i) => {
    cel += `<div class="nono-clue row ${feitoLin[i] ? 'done' : ''}">${DICAS_LIN[i].map((n) => `<span>${n}</span>`).join('')}</div>`;
    for (let j = 0; j < N; j++) {
      const v = grade[i][j];
      const cls = ['nono-cell', v === 1 ? 'on' : v === 2 ? 'x' : '', j % 5 === 4 && j < N - 1 ? 'br' : '', i % 5 === 4 && i < N - 1 ? 'bb' : ''].join(' ');
      cel += `<button class="${cls}" data-act="nonoCell" data-i="${i}" data-j="${j}" aria-label="Linha ${i + 1}, coluna ${j + 1}${v === 1 ? ', pintado' : v === 2 ? ', marcado com X' : ''}"></button>`;
    }
  });

  return `
    <section class="card nono-card ${ok ? 'won' : ''}">
      <p class="muted nono-help">${ok
        ? '<b>Você desenhou o π!</b> 3,14159 26535 89793… ♡'
        : 'Os números dizem quantos quadrados seguidos pintar em cada linha e coluna, na ordem. Entre um bloco e outro sempre fica pelo menos um espaço.'}</p>
      <div class="nono-grid" style="--n:${N}">${cel}</div>
      <div class="nono-actions">
        <div class="seg">
          <button class="${modo === 'pintar' ? 'on' : ''}" data-act="nonoMode" data-m="pintar">■ Pintar</button>
          <button class="${modo === 'marcar' ? 'on' : ''}" data-act="nonoMode" data-m="marcar">✕ Marcar</button>
        </div>
        <button class="btn ghost" data-act="nonoReset">Recomeçar</button>
      </div>
    </section>`;
}
