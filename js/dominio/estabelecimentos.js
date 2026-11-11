// Camada de DOMÍNIO — transforma o nome que vem na fatura ("DL *UBERRIDES",
// "PG *IFOOD", "MERCADOLIVRE*3PRODUTOS") num nome legível ("Uber", "iFood", "Mercado Livre").
import { normTxt, normDesc } from './nubank.js';

// Estabelecimentos conhecidos: [regex no texto normalizado, nome bonito].
// A ordem importa: os mais específicos primeiro (Uber Eats antes de Uber).
export const ESTABELECIMENTOS = [
  [/uber ?eats/, 'Uber Eats'],
  [/\buber/, 'Uber'],
  [/99 ?food/, '99Food'],
  [/\b99 ?(app|pop|taxi|tecnologia|ride)|^99\b/, '99'],
  [/cabify/, 'Cabify'],
  [/ifood|\bifd\b/, 'iFood'],
  [/rappi/, 'Rappi'],
  [/ze ?delivery/, 'Zé Delivery'],
  [/keeta/, 'Keeta'],
  [/mc ?donald|mcdonalds/, "McDonald's"],
  [/burger ?king|\bbk ?brasil/, 'Burger King'],
  [/starbucks/, 'Starbucks'],
  [/subway/, 'Subway'],
  [/habib/, "Habib's"],
  [/outback/, 'Outback'],
  [/coco ?bambu/, 'Coco Bambu'],
  [/madero/, 'Madero'],
  [/netflix/, 'Netflix'],
  [/spotify/, 'Spotify'],
  [/disney/, 'Disney+'],
  [/hbo ?max|\bmax ?com|wbd/, 'Max'],
  [/prime ?video|amazon ?prime|primevideo/, 'Amazon Prime'],
  [/kindle/, 'Kindle'],
  [/amazon|amzn/, 'Amazon'],
  [/youtube/, 'YouTube Premium'],
  [/google ?play/, 'Google Play'],
  [/google ?one|google ?storage/, 'Google One'],
  [/apple ?com|apple ?bill|itunes|icloud/, 'Apple'],
  [/crunchyroll/, 'Crunchyroll'],
  [/deezer/, 'Deezer'],
  [/globoplay|globo ?play/, 'Globoplay'],
  [/paramount/, 'Paramount+'],
  [/twitch/, 'Twitch'],
  [/openai|chatgpt/, 'ChatGPT'],
  [/claude ?ai|anthropic/, 'Claude'],
  [/microsoft|xbox/, 'Microsoft / Xbox'],
  [/playstation|\bpsn\b|sony ?interactive/, 'PlayStation'],
  [/nintendo/, 'Nintendo'],
  [/\bsteam|\bvalve\b/, 'Steam'],
  [/epic ?games/, 'Epic Games'],
  [/riot ?games/, 'Riot Games'],
  [/nuuvem/, 'Nuuvem'],
  [/mercado ?livre|mercadolivre|meli\b/, 'Mercado Livre'],
  [/shopee/, 'Shopee'],
  [/shein/, 'Shein'],
  [/aliexpress|alipay/, 'AliExpress'],
  [/\btemu\b/, 'Temu'],
  [/americanas/, 'Americanas'],
  [/magazine ?luiza|magalu/, 'Magalu'],
  [/casas ?bahia/, 'Casas Bahia'],
  [/kabum/, 'KaBuM!'],
  [/carrefour/, 'Carrefour'],
  [/\bassai/, 'Assaí'],
  [/atacadao/, 'Atacadão'],
  [/pao de acucar/, 'Pão de Açúcar'],
  [/drogasil/, 'Drogasil'],
  [/droga ?raia|\braia(\b|\d)/, 'Droga Raia'],
  [/pague ?menos/, 'Pague Menos'],
  [/panvel/, 'Panvel'],
  [/renner/, 'Renner'],
  [/riachuelo/, 'Riachuelo'],
  [/\bc ?& ?a\b|\bcea\b/, 'C&A'],
  [/\bzara\b/, 'Zara'],
  [/centauro/, 'Centauro'],
  [/netshoes/, 'Netshoes'],
  [/boticario/, 'O Boticário'],
  [/\bnatura\b/, 'Natura'],
  [/sephora/, 'Sephora'],
  [/smart ?fit/, 'Smart Fit'],
  [/cinemark/, 'Cinemark'],
  [/kinoplex/, 'Kinoplex'],
  [/sympla/, 'Sympla'],
  [/ingresso ?com/, 'Ingresso.com'],
  [/airbnb/, 'Airbnb'],
  [/booking/, 'Booking'],
  [/latam/, 'LATAM'],
  [/\bgol ?linhas|voegol/, 'GOL'],
  [/azul ?linhas|voeazul/, 'Azul'],
  [/sem ?parar/, 'Sem Parar'],
  [/conectcar/, 'ConectCar'],
  [/petz/, 'Petz'],
  [/cobasi/, 'Cobasi'],
  [/leroy/, 'Leroy Merlin']
];

// Intermediadores de pagamento que aparecem antes do "*": "DL *", "PG *", "MP *", "EBN *"...
const PREFIXO = /^[a-z0-9.]{1,14}\s?\*\s*/i;
// Sobras comuns no fim: cidade/país, códigos e números de pedido.
const SUFIXOS = [/\s+(br|bra|brasil|sao paulo|sp|rj|osasco|barueri)$/i, /\s+[a-z]*\d{3,}[a-z0-9]*$/i, /\s+\d+$/];

const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o']);
/** "PADARIA PAO QUENTE" → "Padaria Pao Quente". Só mexe se estiver tudo maiúsculo ou minúsculo. */
function capitalizar(s) {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().split(' ').map((w, i) => (i > 0 && PEQUENAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/** Nome legível de um estabelecimento a partir do texto da fatura. */
export function nomeAmigavel(bruto) {
  const original = String(bruto || '').trim();
  if (!original) return original;
  const n = normTxt(original).replace(/[^a-z0-9&]+/g, ' ').trim();
  for (const [re, nome] of ESTABELECIMENTOS) if (re.test(n)) return nome;

  // Desconhecido: tira o intermediador ("DL *"), sobras do fim e arruma maiúsculas.
  let s = original.replace(PREFIXO, '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
  for (let k = 0; k < 3; k++) SUFIXOS.forEach((re) => { s = s.replace(re, '').trim(); });
  s = s.replace(/[\s\-–.,]+$/, '').trim();
  return capitalizar(s || original);
}

/**
 * Nome sugerido para uma compra importada.
 * 1) Se essa mesma compra (pelo nome da fatura) já foi importada e renomeada antes, repete o nome escolhido.
 * 2) Senão, usa nomeAmigavel.
 */
export function sugerirNome(original, tx = []) {
  const chave = normDesc(original);
  const antes = tx.filter((t) => t.descOriginal && normDesc(t.descOriginal) === chave)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  return antes ? antes.desc : nomeAmigavel(original);
}
