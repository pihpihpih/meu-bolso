// Camada de DOMÍNIO — datas, meses e fatura do cartão.
// Datas são strings 'YYYY-MM-DD' e meses são 'YYYY-MM' (é assim que ficam no Firestore).

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Data de hoje no fuso local, como 'YYYY-MM-DD'. */
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/** '2026-03-15' → '2026-03' */
export const ymOf = (iso) => iso.slice(0, 7);

/** Soma (ou subtrai) meses: addMonths('2026-12', 1) → '2027-01'. */
export const addMonths = (ym, n) => {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};

/** '2026-03' → 'Março 2026' */
export const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${cap(MONTHS[m - 1])} ${y}`; };

/** '2026-03' → 'março' */
export const monthName = (ym) => MONTHS[Number(ym.split('-')[1]) - 1];

/** '2026-03-15' → '15/03' */
export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/**
 * Mês de referência (mês de VENCIMENTO da fatura) de uma compra.
 * Débito/sem conta: o próprio mês da data.
 * Crédito: depende do dia de fechamento e de vencimento do cartão.
 * Ex.: fecha dia 1 e vence dia 10 → compra em 15/03 cai na fatura de abril.
 */
export function refMonth(dateISO, acc) {
  const ym = ymOf(dateISO);
  if (!acc || acc.type !== 'credit') return ym;
  const d = Number(dateISO.slice(8, 10));
  const close = Number(acc.closingDay) || 1;
  const due = Number(acc.dueDay) || 10;
  const closeYm = d >= close ? addMonths(ym, 1) : ym; // em que mês essa fatura fecha
  return due > close ? closeYm : addMonths(closeYm, 1); // em que mês ela vence
}
