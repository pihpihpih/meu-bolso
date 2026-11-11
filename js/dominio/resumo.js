// Camada de DOMÍNIO — contas do mês (quanto entrou, quanto saiu, por cartão e categoria).
import { round2, sum } from './dinheiro.js';

/** Gastos fixos que valem no mês `ym` (entre startMonth e endMonth). */
export const activeRecurring = (rec, ym) => rec.filter((r) => (r.startMonth || '0000') <= ym && (!r.endMonth || ym <= r.endMonth));

/**
 * Resumo de um mês.
 * Recebe os dados por parâmetro (em vez de ler o estado global) para ser uma função pura.
 * @param {string} ym  mês 'YYYY-MM'
 * @param {{tx:Array, rec:Array, incomes:Array, accounts:Array}} dados
 */
export function monthSummary(ym, { tx: allTx, rec, incomes, accounts }) {
  const tx = allTx.filter((t) => t.month === ym);
  const exp = tx.filter((t) => t.kind !== 'income');
  const inc = tx.filter((t) => t.kind === 'income');
  const fixed = activeRecurring(rec, ym).map((r) => ({ ...r, fixed: true }));
  const incomeBase = sum(incomes);
  const income = round2(incomeBase + sum(inc));
  const all = [...fixed, ...exp];
  const spent = sum(all);
  const byAcc = { fixos: sum(fixed) };
  accounts.forEach((a) => (byAcc[a.id] = sum(exp.filter((t) => t.acc === a.id))));
  const byCat = {};
  all.forEach((t) => (byCat[t.cat] = round2((byCat[t.cat] || 0) + t.amount)));
  return { tx, exp, inc, fixed, income, incomeBase, spent, left: round2(income - spent), byAcc, byCat };
}
