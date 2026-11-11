// Camada de dados: Firebase (login + Firestore com cache offline)
// ou modo demonstração (localStorage) quando a config não foi preenchida.
//
// Estrutura no Firestore:
//   users/{uid}                    -> { sheetId, theme }  (perfil de cada pessoa)
//   sheets/{sheetId}               -> { owner, members:[uid...], names:{uid:nome}, inviteOpen }
//   sheets/{sheetId}/transactions  -> lançamentos
//   sheets/{sheetId}/recurring     -> gastos fixos
//   sheets/{sheetId}/meta/settings -> categorias, contas, rendas
// Uma "planilha" pode ter várias pessoas: o convite é o próprio sheetId.
import { firebaseConfig } from './firebase-config.js';

export const DEMO = !firebaseConfig || !firebaseConfig.apiKey || /COLE/i.test(firebaseConfig.apiKey);

const CDN = 'https://www.gstatic.com/firebasejs/11.0.2/';
let F = {}, auth = null, db = null, uid = null, sheetId = null;

const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore não aceita "undefined"
const strip = ({ id, __rec, fixed, ...rest }) => clean(rest);

// ---------------- Modo demonstração ----------------
const demo = {
  key: 'mb-demo-data',
  data: null,
  h: null,
  load() {
    if (this.data) return this.data;
    try { this.data = JSON.parse(localStorage.getItem(this.key)) || null; } catch (e) { this.data = null; }
    if (!this.data) this.data = { transactions: {}, recurring: {}, settings: null };
    return this.data;
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  emit(col) {
    if (!this.h) return;
    const d = this.load();
    if (!col || col === 'transactions') this.h.tx(Object.entries(d.transactions).map(([id, v]) => ({ id, ...v })));
    if (!col || col === 'recurring') this.h.rec(Object.entries(d.recurring).map(([id, v]) => ({ id, ...v })));
    if (!col || col === 'settings') this.h.settings({ data: d.settings, exists: !!d.settings, fromCache: false });
  }
};

// ---------------- Inicialização ----------------
export async function initBackend(onUser) {
  if (DEMO) { setTimeout(() => onUser({ uid: 'demo', email: 'modo demonstração', demo: true }), 0); return; }
  const [A, Au, Fs] = await Promise.all([
    import(CDN + 'firebase-app.js'),
    import(CDN + 'firebase-auth.js'),
    import(CDN + 'firebase-firestore.js')
  ]);
  F = { ...A, ...Au, ...Fs };
  const app = F.initializeApp(firebaseConfig);
  auth = F.getAuth(app);
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) { db = F.getFirestore(app); }
  F.onAuthStateChanged(auth, (u) => onUser(u ? { uid: u.uid, email: u.email, name: u.displayName } : null));
}

// ---------------- Login ----------------
export const authApi = {
  async google() {
    const p = new F.GoogleAuthProvider();
    try { await F.signInWithPopup(auth, p); }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) return F.signInWithRedirect(auth, p);
      throw e;
    }
  },
  login: (e, p) => F.signInWithEmailAndPassword(auth, e, p),
  signup: (e, p) => F.createUserWithEmailAndPassword(auth, e, p),
  reset: (e) => F.sendPasswordResetEmail(auth, e),
  logout: () => (DEMO ? location.reload() : F.signOut(auth))
};

// ---------------- Leitura em tempo real ----------------
/**
 * h: { profile, sheet, reset, noSheet, tx, rec, settings, error }
 * noSheet() é chamado quando a pessoa ainda não tem planilha: o app decide
 * se cria uma nova (share.createOwn) ou entra por convite (share.join).
 */
export function watchUser(userId, h) {
  uid = userId;
  if (DEMO) {
    sheetId = 'demo';
    demo.h = h;
    h.sheet && h.sheet({ id: 'demo', owner: 'demo', members: ['demo'], names: { demo: 'Você' }, inviteOpen: true });
    demo.emit();
    return () => {};
  }
  const err = (e) => h.error && h.error(e);
  let inner = null, curSid = null, asked = false;

  const subSheet = (sid) => {
    if (inner) inner();
    curSid = sid; sheetId = sid;
    const u0 = F.onSnapshot(F.doc(db, 'sheets', sid), (s) => h.sheet(s.exists() ? { id: sid, ...s.data() } : null),
      (e) => { if (e.code === 'permission-denied' && h.lost) h.lost(); else err(e); });
    const quiet = (e) => { if (e.code !== 'permission-denied') err(e); };
    const u1 = F.onSnapshot(F.collection(db, 'sheets', sid, 'transactions'),
      (s) => h.tx(s.docs.map((d) => ({ id: d.id, ...d.data() }))), quiet);
    const u2 = F.onSnapshot(F.collection(db, 'sheets', sid, 'recurring'),
      (s) => h.rec(s.docs.map((d) => ({ id: d.id, ...d.data() }))), quiet);
    const u3 = F.onSnapshot(F.doc(db, 'sheets', sid, 'meta', 'settings'), { includeMetadataChanges: true },
      (s) => h.settings({ data: s.exists() ? s.data() : null, exists: s.exists(), fromCache: s.metadata.fromCache }), quiet);
    inner = () => { u0(); u1(); u2(); u3(); };
  };

  const uu = F.onSnapshot(F.doc(db, 'users', uid), { includeMetadataChanges: true }, (s) => {
    const data = s.exists() ? s.data() : null;
    h.profile && h.profile(data);
    if (data && data.sheetId) {
      // Espera o servidor confirmar a troca antes de assinar a planilha nova.
      if (s.metadata.hasPendingWrites) return;
      if (data.sheetId !== curSid) { if (curSid) h.reset(); subSheet(data.sheetId); }
      return;
    }
    if (s.metadata.fromCache || asked) return;
    asked = true;
    h.noSheet();
  }, err);

  return () => { uu(); inner && inner(); };
}

// ---------------- Compartilhamento ----------------
export const share = {
  get sheetId() { return sheetId; },
  /** Cria uma planilha nova só sua e passa a usar ela. */
  async createOwn(name) {
    if (DEMO) return;
    const ref = F.doc(F.collection(db, 'sheets'));
    const b = F.writeBatch(db);
    b.set(ref, { owner: uid, members: [uid], names: { [uid]: name }, inviteOpen: true, createdAt: Date.now() });
    b.set(F.doc(db, 'users', uid), { sheetId: ref.id }, { merge: true });
    await b.commit();
    return ref.id;
  },
  /** Entra na planilha de outra pessoa usando o código do convite. */
  async join(sid, name) {
    if (DEMO) throw new Error('Compartilhar precisa do Firebase configurado.');
    await F.updateDoc(F.doc(db, 'sheets', sid), { members: F.arrayUnion(uid), ['names.' + uid]: name });
    await F.setDoc(F.doc(db, 'users', uid), { sheetId: sid }, { merge: true });
  },
  /** Sai da planilha compartilhada e começa uma nova só sua. */
  async leave(name) {
    const old = sheetId;
    await share.createOwn(name);
    await F.updateDoc(F.doc(db, 'sheets', old), { members: F.arrayRemove(uid) }).catch(() => {});
  },
  removeMember: (memberUid) => F.updateDoc(F.doc(db, 'sheets', sheetId), { members: F.arrayRemove(memberUid) }),
  setInviteOpen: (open) => F.updateDoc(F.doc(db, 'sheets', sheetId), { inviteOpen: !!open }),
  setName: (name) => (DEMO ? Promise.resolve() : F.updateDoc(F.doc(db, 'sheets', sheetId), { ['names.' + uid]: name }))
};

// ---------------- Escrita ----------------
// As escritas não são aguardadas na interface: o Firestore aplica na hora
// localmente (mesmo offline) e sincroniza quando houver internet.
const ref = (col, id) => F.doc(db, 'sheets', sheetId, col, id);
async function chunked(items, fn) {
  for (let i = 0; i < items.length; i += 400) {
    const b = F.writeBatch(db);
    items.slice(i, i + 400).forEach((it) => fn(b, it));
    await b.commit();
  }
}

export const store = {
  put(col, id, data) {
    if (DEMO) { const d = demo.load(); d[col][id] = strip(data); demo.save(); demo.emit(col); return Promise.resolve(); }
    return F.setDoc(ref(col, id), strip(data));
  },
  putMany(col, items) {
    if (DEMO) { const d = demo.load(); items.forEach((it) => (d[col][it.id] = strip(it))); demo.save(); demo.emit(col); return Promise.resolve(); }
    return chunked(items, (b, it) => b.set(ref(col, it.id), strip(it)));
  },
  del(col, id) {
    if (DEMO) { const d = demo.load(); delete d[col][id]; demo.save(); demo.emit(col); return Promise.resolve(); }
    return F.deleteDoc(ref(col, id));
  },
  delMany(col, ids) {
    if (DEMO) { const d = demo.load(); ids.forEach((id) => delete d[col][id]); demo.save(); demo.emit(col); return Promise.resolve(); }
    return chunked(ids, (b, id) => b.delete(ref(col, id)));
  },
  saveSettings(data) {
    if (DEMO) { const d = demo.load(); d.settings = clean(data); demo.save(); demo.emit('settings'); return Promise.resolve(); }
    return F.setDoc(F.doc(db, 'sheets', sheetId, 'meta', 'settings'), clean(data));
  },
  /** Preferências pessoais (tema), separadas da planilha compartilhada. */
  saveProfile(patch) {
    if (DEMO) return Promise.resolve();
    return F.setDoc(F.doc(db, 'users', uid), clean(patch), { merge: true });
  }
};
