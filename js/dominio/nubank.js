// Camada de DOMÍNIO — leitura da fatura do Nubank (CSV) e sugestão de categoria.
// Formato do app/e-mail do Nubank:  date,title,amount
// (versões antigas: date,category,title,amount)
import { round2 } from './dinheiro.js';

/** Lê um CSV (separador , ou ; detectado sozinho, aspas e quebras de linha tratadas). */
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** Minúsculo e sem acento. */
export const normTxt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Descrição "limpa" para comparar estabelecimentos (sem "parcela 1/3", sem pontuação). */
export const normDesc = (s) => normTxt(s).replace(/-?\s*parcela\s*\d+\s*\/\s*\d+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** "1.234,56" / "1,234.56" / "R$ 10" → número. Inválido → null. */
export function parseMoney(s) {
  s = String(s || '').trim().replace(/R\$|\s/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else s = s.replace(/,/g, '');                                         // 1,234.56 / 1234.56
  const n = parseFloat(s); return isNaN(n) ? null : n;
}

/** "2026-03-15" ou "15/03/2026" ou "15/03/26" → '2026-03-15'. Inválido → null. */
export function parseDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}

/** Transforma o texto do CSV em linhas { date, amount, title, desc, nuCat, inst }. Lança erro se o formato não bater. */
export function parseNubank(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('o arquivo está vazio');
  const head = rows[0].map(normTxt);
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const iDate = col('date', 'data'), iTitle = col('title', 'descricao', 'description', 'estabelecimento'), iAmt = col('amount', 'valor'), iCat = col('category', 'categoria');
  if (iDate < 0 || iTitle < 0 || iAmt < 0) throw new Error('não reconheci as colunas (esperava date, title, amount)');
  const out = [];
  rows.slice(1).forEach((r) => {
    const date = parseDate(r[iDate]), amount = parseMoney(r[iAmt]), title = String(r[iTitle] || '').trim();
    if (!date || amount === null || !title) return;
    const pm = title.match(/parcela\s*(\d+)\s*\/\s*(\d+)/i);
    const desc = title.replace(/\s*-?\s*parcela\s*\d+\s*\/\s*\d+\s*/i, ' ').replace(/\s+/g, ' ').trim() || title;
    out.push({ date, amount: round2(amount), title, desc, nuCat: iCat >= 0 ? normTxt(r[iCat]) : '', inst: pm ? { i: Number(pm[1]), n: Number(pm[2]) } : null });
  });
  return out;
}

/** Linha de "Pagamento recebido" (pagamento da fatura) — não é compra, é ignorada. */
export const isPayment = (r) => /pagamento (recebido|em|efetuado)|^pagamento$|pagto/i.test(normTxt(r.title));

// Palavras-chave -> categoria (usadas quando ainda não há histórico)
export const CAT_RULES = [
  ['lanche', /\b(uber ?eats|ifood)/],
  ['transporte', /\b(uber|99 ?app|99 ?pop|99 ?taxi|cabify|posto|shell|ipiranga|petrobras|br mania|combustivel|gasolina|estacion|sem parar|conectcar|veloe|metro|bilhete|onibus)\b/],
  ['lanche', /\b(ifood|rappi|ze delivery|lanche|lanchonete|padaria|panificadora|burger|mc ?donald|bk |subway|habib|bobs|giraffas|cafe|cafeteria|starbucks|acai|sorvet|doceria|confeitaria|pastel|pizza)/],
  ['mercado', /\b(mercado|supermerc|carrefour|assai|atacad|extra|pao de acucar|big|sams|makro|hortifruti|sacolao|dia )/],
  ['restaurante', /\b(restaurante|churrascaria|outback|madero|coco bambu|sushi|temaki|bar |boteco|cervejaria|grill|cantina)/],
  ['saude', /\b(farmacia|drogaria|drogasil|droga raia|raia|pague menos|panvel|hospital|clinica|laborat|consulta|dentista|unimed|odonto)/],
  ['contas', /\b(spotify|netflix|disney|hbo|max|prime video|amazon prime|youtube|crunchyroll|twitch|apple com|apple|icloud|google|deezer|globoplay|paramount|claro|vivo|tim |oi |internet|energia|enel|cemig|copel|sabesp|agua|gas )/],
  ['jogos', /\b(steam|playstation|psn|xbox|nintendo|nuuvem|epic games|riot|blizzard|battle ?net|garena|valve|gamepass|game)/],
  ['vestuario', /\b(renner|c a|cea|riachuelo|zara|shein|hering|marisa|pernambucanas|centauro|netshoes|nike|adidas|youcom|forever|calcad|sapat|roupa|moda)/],
  ['cosmeticos', /\b(boticario|natura|sephora|avon|eudora|quem disse berenice|beleza|cosmetic|perfum|salao|barbearia|barba|cabelo|manicure|esmalte)/],
  ['educacao', /\b(udemy|alura|coursera|curso|escola|faculdade|universidade|livraria|saraiva|amazon kindle|kindle|duolingo|psicolog)/],
  ['lazer', /\b(cinema|cinemark|ingresso|ticketmaster|sympla|eventim|teatro|show|parque|museu|kinoplex|uci )/],
  ['viagem', /\b(airbnb|booking|hotel|pousada|latam|gol |azul|decolar|123 ?milhas|hurb|rodoviaria|clickbus|buser)/],
  ['casa', /\b(leroy|tok stok|camicado|etna|magazine luiza|magalu|casas bahia|ponto frio|mobly|madeira|telhanorte|ferragens|utilidades)/],
  ['outros', /\b(shopee|amazon|mercado ?livre|mercadolivre|aliexpress|temu|americanas|submarino|pix|transfer)/]
];
// Categorias do próprio Nubank (CSV antigo) -> categorias do app
export const NU_CATS = { transporte: 'transporte', restaurante: 'restaurante', supermercado: 'mercado', mercado: 'mercado', saude: 'saude', educacao: 'educacao', lazer: 'lazer', viagem: 'viagem', vestuario: 'vestuario', casa: 'casa', servicos: 'contas', eletronicos: 'outros', outros: 'outros' };

/**
 * Sugere a categoria de uma compra importada.
 * Ordem: 1) mesmo estabelecimento já categorizado antes  2) palavras-chave  3) categoria do arquivo  4) "outros".
 * @param {{tx:Array, rec:Array, categories:Array}} historico
 */
export function guessCat(row, { tx, rec, categories }) {
  const nd = normDesc(row.desc);
  const valid = (id) => (categories.some((c) => c.id === id) ? id : null);
  const past = [...tx].filter((t) => t.kind !== 'income' && t.cat && normDesc(t.desc) === nd).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
    || rec.find((r) => normDesc(r.desc) === nd);
  if (past && valid(past.cat)) return past.cat;
  const hay = ' ' + nd + ' ';
  for (const [id, re] of CAT_RULES) if (re.test(hay) && valid(id)) return id;
  if (row.nuCat && valid(NU_CATS[row.nuCat])) return NU_CATS[row.nuCat];
  return valid('outros') || categories[0]?.id;
}

/** Chave única de uma linha importada — evita importar a mesma compra duas vezes. */
export const srcKey = (r) => `nu|${r.date}|${normDesc(r.title)}|${r.amount.toFixed(2)}|${r.inst ? r.inst.i + '/' + r.inst.n : ''}`;

/** Hash curto (djb2) de um texto. */
export function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

/** Procura em `tx` um lançamento que já seja essa mesma compra (pela chave ou por valor/mês/descrição). */
export function findDuplicate(r, acc, month, tx) {
  const key = srcKey(r);
  return tx.find((t) => t.srcKey === key) || tx.find((t) =>
    t.kind !== 'income' && t.acc === acc && t.month === month && Math.abs(t.amount - r.amount) < 0.005 &&
    (r.inst ? (t.inst && t.inst.i === r.inst.i && t.inst.n === r.inst.n) : normDesc(t.desc) === normDesc(r.desc) || t.date === r.date));
}
