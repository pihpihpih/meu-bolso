// Camada de APLICAÇÃO — ajustes da planilha, backup e exportação.
import { store } from '../db.js';
import { ddmm, todayISO } from '../dominio/datas.js';
import { DEFAULT_SETTINGS, DEFAULT_RECURRING } from '../dominio/padroes.js';

/** Primeira vez de uma planilha: grava categorias, contas e gastos fixos padrão. */
export function criarPlanilhaPadrao(uid) {
  return Promise.all([
    store.saveSettings(DEFAULT_SETTINGS),
    store.putMany('recurring', DEFAULT_RECURRING.map((r) => ({ ...r, by: uid })))
  ]);
}

export const salvarAjustes = (settings) => store.saveSettings(settings);

/** Conteúdo do arquivo de backup (JSON). */
export function gerarBackup({ settings, tx, rec }) {
  return {
    nome: `meu-bolso-backup-${todayISO()}.json`,
    texto: JSON.stringify({ version: 1, settings, transactions: tx, recurring: rec }, null, 1)
  };
}

/** Lê e valida o backup. Lança erro se o arquivo não for um backup do app. */
export function lerBackup(texto) {
  const data = JSON.parse(texto);
  if (!data.settings || !Array.isArray(data.transactions)) throw new Error('arquivo inválido');
  return { settings: data.settings, transactions: data.transactions, recurring: data.recurring || [] };
}

/** Grava o backup lido (adiciona/atualiza; não apaga o que já existe). */
export async function restaurarBackup(data) {
  await store.saveSettings(data.settings);
  await store.putMany('transactions', data.transactions);
  await store.putMany('recurring', data.recurring);
}

/**
 * CSV do mês (abre no Excel/Sheets em português: separador ";" e vírgula decimal).
 * d: resultado de monthSummary; nomes: { cat(id), acc(id) } para traduzir ids em nomes.
 */
export function gerarCsvDoMes(month, d, nomes) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const num = (v) => String(v.toFixed(2)).replace('.', ',');
  const rows = [['Data', 'Descrição', 'Categoria', 'Conta', 'Parcela', 'Tipo', 'Valor']];
  d.fixed.forEach((r) => rows.push(['', r.desc, nomes.cat(r.cat), 'Gastos fixos', '', 'Fixo', num(r.amount)]));
  [...d.exp, ...d.inc].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((t) => rows.push([
    ddmm(t.date), t.desc, t.kind === 'income' ? '' : nomes.cat(t.cat), t.kind === 'income' ? '' : nomes.acc(t.acc),
    t.inst ? `${t.inst.i}/${t.inst.n}` : '', t.kind === 'income' ? 'Entrada' : 'Gasto', num(t.amount)]));
  return { nome: `gastos-${month}.csv`, texto: '﻿' + rows.map((r) => r.map(q).join(';')).join('\n') };
}
