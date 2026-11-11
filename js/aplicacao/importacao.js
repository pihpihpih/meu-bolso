// Camada de APLICAÇÃO — importar a fatura do Nubank (CSV).
// O fluxo tem duas etapas, com a tela no meio:
//   1. lerFatura: lê o arquivo e sugere cartão, mês e categorias;
//   2. a pessoa revisa na tela (app.js);
//   3. importarCompras: grava as compras escolhidas.
import { store } from '../db.js';
import { refMonth } from '../dominio/datas.js';
import { parseNubank, isPayment, normDesc, guessCat, srcKey, hashStr, findDuplicate } from '../dominio/nubank.js';
import { sugerirNome } from '../dominio/estabelecimentos.js';
import { newId } from './lancamentos.js';

/** Cartão sugerido: o de crédito com "nu" no nome, senão o primeiro de crédito. */
export function cartaoSugerido(accounts) {
  const credit = accounts.filter((a) => a.type === 'credit');
  return (credit.find((a) => /nu/i.test(a.name)) || credit[0] || accounts[0]).id;
}

/** Mês da fatura sugerido: o da compra mais recente, no cartão escolhido. */
export function mesSugerido(rows, acc) {
  const lastDate = rows.map((r) => r.date).sort().pop();
  return refMonth(lastDate, acc);
}

/**
 * Lê o texto do CSV. Lança erro se o arquivo não for válido.
 * ctx: { tx, rec, categories } (histórico usado para sugerir categoria)
 * Devolve { rows, payments }: compras (com idx e cat sugerida) e pagamentos ignorados.
 */
export function lerFatura(texto, ctx) {
  const all = parseNubank(texto);
  const payments = all.filter(isPayment);
  const rows = all.filter((r) => !isPayment(r));
  rows.forEach((r, i) => {
    r.idx = i;
    r.original = r.desc;                      // como veio na fatura: "DL *UBERRIDES"
    r.desc = sugerirNome(r.original, ctx.tx); // como aparece no app: "Uber"
    r.cat = guessCat(r, ctx);
  });
  return { rows, payments };
}

/** A pessoa mudou o nome de uma compra: aplica o mesmo nome às outras do mesmo lugar. Devolve as linhas alteradas. */
export function renomearCompra(rows, row, nome) {
  nome = String(nome || '').trim() || row.original;
  const mesmas = rows.filter((r) => normDesc(r.original) === normDesc(row.original));
  mesmas.forEach((r) => { r.desc = nome; });
  return mesmas;
}

/** Marca as compras que já foram lançadas antes (e desmarca elas). */
export function marcarDuplicadas(rows, acc, month, tx) {
  rows.forEach((r) => { r.dup = !!findDuplicate(r, acc, month, tx); r.on = !r.dup; });
}

/** Grava as compras marcadas na fatura escolhida. Devolve { count, promise }. */
export function importarCompras(rows, { acc, month, uid }) {
  const now = Date.now();
  const items = rows.filter((r) => r.on).map((r, k) => ({
    id: newId() + k, kind: 'expense', desc: r.desc, amount: r.amount, cat: r.cat, acc, date: r.date, month,
    inst: r.inst ? { ...r.inst, group: 'nu' + hashStr(acc + '|' + normDesc(r.original || r.desc) + '|' + r.inst.n + '|' + r.amount.toFixed(2)) } : null,
    createdAt: now + k, by: uid, src: 'nubank-csv', srcKey: srcKey(r), descOriginal: r.original || r.desc
  }));
  return { count: items.length, promise: store.putMany('transactions', items) };
}
