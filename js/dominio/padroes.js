// Camada de DOMÍNIO — valores iniciais de uma planilha nova.
// (tirados da planilha original — dá pra editar tudo no app)

export const DEFAULT_SETTINGS = {
  appName: 'Meu Bolso',
  categories: [
    { id: 'contas', name: 'Contas', icon: '🧾', color: '#e88a8a' },
    { id: 'cosmeticos', name: 'Cosméticos', icon: '💄', color: '#f0a36b' },
    { id: 'educacao', name: 'Educação', icon: '📚', color: '#e8c75a' },
    { id: 'lazer', name: 'Lazer', icon: '🎉', color: '#8fcf7a' },
    { id: 'mercado', name: 'Mercado', icon: '🛒', color: '#6fb3e0' },
    { id: 'outros', name: 'Outros', icon: '📦', color: '#8aa9b8' },
    { id: 'lanche', name: 'Lanche', icon: '🍔', color: '#b39ddb' },
    { id: 'jogos', name: 'Jogos', icon: '🎮', color: '#e57373' },
    { id: 'restaurante', name: 'Restaurante', icon: '🍽️', color: '#ff9f6e' },
    { id: 'saude', name: 'Saúde', icon: '💊', color: '#f2d16b' },
    { id: 'transporte', name: 'Transporte', icon: '🚗', color: '#7cc47f' },
    { id: 'casa', name: 'Compras casa', icon: '🏠', color: '#64b5f6' },
    { id: 'vestuario', name: 'Vestuário', icon: '👕', color: '#80a4b0' },
    { id: 'viagem', name: 'Viagem', icon: '✈️', color: '#c5a3e0' }
  ],
  accounts: [
    { id: 'xp', name: 'Cartão XP', type: 'credit', closingDay: 1, dueDay: 10, color: '#e88a8a' },
    { id: 'nubank', name: 'Nubank', type: 'credit', closingDay: 1, dueDay: 10, color: '#a78bfa' },
    { id: 'debito', name: 'Débito / Pix', type: 'debit', color: '#6ec59a' }
  ],
  incomes: [
    { id: 'r1', name: 'Fonte de Renda 1', amount: 1577 },
    { id: 'r2', name: 'Fonte de Renda 2', amount: 1992 },
    { id: 'r3', name: 'Fonte de Renda 3', amount: 400 }
  ]
};

export const DEFAULT_RECURRING = [
  ['Crunchyroll', 20, 'contas'], ['WoW', 40, 'jogos'], ['Spotify', 23.9, 'contas'], ['Celular Pih', 162, 'contas'],
  ['Twitch Turbo', 25, 'contas'], ['Gamepass', 76, 'jogos'], ['Clube iFood', 8, 'lanche']
].map(([desc, amount, cat], i) => ({ id: 'fx' + i, desc, amount, cat, startMonth: '2020-01', endMonth: null, createdAt: Date.now() + i }));
