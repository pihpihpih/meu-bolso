// Camada de DOMÍNIO — parcelamento.
import { round2 } from './dinheiro.js';

/**
 * Divide uma compra em parcelas.
 * mode 'total': `amount` é o valor total → parcelas iguais (arredondadas pra baixo)
 *               e a última absorve os centavos que sobraram. Ex.: 100 em 3x → 33,33 + 33,33 + 33,34.
 * mode 'each':  `amount` já é o valor de cada parcela.
 * Retorna { per, last }: valor das parcelas normais e da última.
 */
export function splitInstallments(amount, n, mode = 'total') {
  if (mode !== 'total') return { per: amount, last: amount };
  const per = Math.floor((amount / n) * 100) / 100;
  return { per, last: round2(amount - per * (n - 1)) };
}
