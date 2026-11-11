// Camada de DOMÍNIO — dinheiro.
// Regras puras: não mexem na tela nem no banco. Dá pra testar sozinhas.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata um número como R$ 1.234,56. */
export const money = (v) => BRL.format(v || 0);

/** Arredonda para 2 casas sem erro de ponto flutuante (0,1 + 0,2 = 0,3). */
export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Soma uma lista (por padrão o campo `amount`), já arredondando. */
export const sum = (arr, f = (x) => x.amount) => round2(arr.reduce((a, x) => a + (Number(f(x)) || 0), 0));

/** Lê um número digitado pela pessoa ("1.234,56", "R$ 10", "3.5"). Inválido vira 0. */
export const parseNum = (s) => {
  s = String(s ?? '').trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
};
