// Camada de APLICAÇÃO — casos de uso dos lançamentos.
// Junta as regras do domínio com o banco (db.js). Não mexe na tela:
// recebe os dados por parâmetro e devolve a Promise da gravação,
// para quem chamou decidir como mostrar erro.
import { store } from '../db.js';
import { ymOf, addMonths, refMonth } from '../dominio/datas.js';
import { splitInstallments } from '../dominio/parcelas.js';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** Todas as parcelas da mesma compra parcelada. */
export const parcelasDoGrupo = (lanc, tx) => tx.filter((t) => t.inst && lanc.inst && t.inst.group === lanc.inst.group);

/**
 * Salva um lançamento novo ou editado.
 * dados: { kind: 'expense'|'income'|'fixed', desc, amount, cat, acc, date, n, mode }
 * ctx:   { existing, applyAll, uid, month (mês aberto na tela), tx, accounts }
 */
export function salvarLancamento(dados, ctx) {
  const { existing = null, applyAll = false, uid, month, tx = [], accounts = [] } = ctx;
  const { desc, amount, cat } = dados;
  const now = Date.now();

  // Gasto fixo: vale todo mês a partir do mês aberto.
  if (dados.kind === 'fixed') {
    const base = existing && existing.__rec ? { ...existing } : { id: newId(), startMonth: month, endMonth: null, createdAt: now };
    return store.put('recurring', base.id, { by: uid, ...base, desc, amount, cat });
  }

  // Entrada: conta no mês da própria data.
  if (dados.kind === 'income') {
    const id = existing ? existing.id : newId();
    return store.put('transactions', id, { ...(existing || { createdAt: now, by: uid }), kind: 'income', desc, amount, date: dados.date, month: ymOf(dados.date), cat: null, acc: null });
  }

  // Gasto: conta no mês da fatura do cartão.
  const acc = accounts.find((a) => a.id === dados.acc) || null;
  const base = refMonth(dados.date, acc);
  const campos = { desc, amount, cat, acc: dados.acc, date: dados.date };

  if (existing) {
    if (existing.inst && applyAll) {
      const grupo = parcelasDoGrupo(existing, tx);
      return store.putMany('transactions', grupo.map((t) => ({ ...t, ...campos, month: addMonths(base, t.inst.i - 1) })));
    }
    const m = existing.inst ? addMonths(base, existing.inst.i - 1) : base;
    return store.put('transactions', existing.id, { ...existing, ...campos, month: m });
  }

  if (dados.n === 1) {
    return store.put('transactions', newId(), { kind: 'expense', ...campos, month: base, inst: null, createdAt: now, by: uid });
  }

  // Parcelado: cria todas as parcelas nas faturas seguintes.
  const group = newId();
  const { per, last } = splitInstallments(amount, dados.n, dados.mode);
  const items = Array.from({ length: dados.n }, (_, i) => ({
    id: newId() + i, kind: 'expense', ...campos, amount: i === dados.n - 1 ? last : per,
    month: addMonths(base, i), inst: { i: i + 1, n: dados.n, group }, createdAt: now + i, by: uid
  }));
  return store.putMany('transactions', items);
}

/** Exclui um lançamento. Se for parcela e todas=true, exclui a compra inteira. */
export function excluirLancamento(lanc, { todas = false, tx = [] } = {}) {
  if (lanc.inst && todas) return store.delMany('transactions', parcelasDoGrupo(lanc, tx).map((t) => t.id));
  return store.del('transactions', lanc.id);
}

/** Encerra um gasto fixo: ele some a partir do mês informado (os anteriores ficam). */
export const encerrarGastoFixo = (rec, aPartirDe) => store.put('recurring', rec.id, { ...rec, endMonth: addMonths(aPartirDe, -1) });

/** Remove o gasto fixo de todos os meses. */
export const excluirGastoFixo = (rec) => store.del('recurring', rec.id);
