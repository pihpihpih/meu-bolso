# Meu Bolso ♡ — guia completo

App de controle financeiro que funciona no **celular** (instalado na tela inicial) e no **computador** (pelo navegador), com os dados sincronizados entre os dois.

- **Firebase** (Google, gratuito) guarda os dados e faz o login.
- **GitHub Pages** (gratuito) deixa o site no ar, num endereço tipo `https://seunome.github.io/meu-bolso/`.

Leva uns 20–30 minutos na primeira vez. Você não precisa saber programar: é só clicar, copiar e colar.

---

## O que tem na pasta

| Arquivo | Para que serve |
|---|---|
| `index.html` | A página do app |
| `css/style.css` | Visual e os dois temas (Escuro e Pih ♡) |
| `js/app.js` | Telas e lógica (parcelas, faturas, totais) |
| `js/db.js` | Conversa com o Firebase |
| `js/firebase-config.js` | **O único arquivo que você precisa editar** |
| `firestore.rules` | Regras de segurança do banco (você cola no Firebase) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Deixam o site "instalável" e funcionando sem internet |

> Dica: antes de configurar qualquer coisa, você já pode subir a pasta pro GitHub (passo 5). Sem a configuração do Firebase o app abre em **modo demonstração**, e os dados ficam só naquele aparelho.

---

## Passo 1 — Criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **Criar um projeto** (ou "Adicionar projeto").
3. Nome: `meu-bolso` → Continuar.
4. O Google Analytics pode ficar **desativado** → **Criar projeto**.
5. Na página do projeto, clique no ícone **`</>`** (Web) para adicionar um app web.
6. Apelido: `meu-bolso-web`. **Não** marque "Firebase Hosting". Clique em **Registrar app**.
7. Vai aparecer um código com `const firebaseConfig = { ... }`. **Deixe essa aba aberta**, você vai usar no passo 4.

## Passo 2 — Ativar o login

1. No menu da esquerda: **Criação → Authentication** → **Vamos começar**.
2. Na aba **Método de login**:
   - Clique em **E-mail/senha** → ative a primeira chave → **Salvar**.
   - Clique em **Adicionar novo provedor → Google** → ative → escolha seu e-mail de suporte → **Salvar**.

## Passo 3 — Criar o banco de dados

1. Menu da esquerda: **Criação → Firestore Database** → **Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)** → Avançar.
3. Escolha **Iniciar no modo de produção** → **Criar**.
4. Abra a aba **Regras**, apague tudo o que estiver lá e cole **todo** o conteúdo do arquivo `firestore.rules` (abra com o Bloco de Notas).
5. Clique em **Publicar**.

> ⚠️ **Não pule este passo.** São essas regras que garantem que só você (e quem você convidar) vê os gastos.

## Passo 4 — Colar a configuração no app

1. Abra `js/firebase-config.js` com o Bloco de Notas (ou o editor do próprio GitHub, no passo 5).
2. Troque o objeto inteiro pelo que o Firebase mostrou no passo 1. O resultado fica parecido com isto:

```js
export const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "meu-bolso-xxxx.firebaseapp.com",
  projectId: "meu-bolso-xxxx",
  storageBucket: "meu-bolso-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

3. Mantenha o `export` no começo. Se perder a aba do passo 1, ela fica em ⚙️ **Configurações do projeto → Geral → Seus apps**.

> A `apiKey` não é uma senha. É normal ela ficar visível no site. Quem protege seus dados são as regras do passo 3.

## Passo 5 — Colocar o site no ar (GitHub Pages)

1. Crie uma conta em **https://github.com** (se ainda não tiver).
2. Clique em **+ → New repository**.
   - Nome: `meu-bolso`
   - Marque **Public** (o Pages grátis exige repositório público; seus dados **não** ficam no repositório, só o código).
   - **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. **Abra a pasta `meu-bolso` no seu computador**, selecione **tudo o que está dentro dela** (`index.html`, `css`, `js`, `icons`, ...) e arraste para o navegador. Arraste o conteúdo, não a pasta em si.
5. Clique em **Commit changes**.
6. Vá em **Settings → Pages**. Em *Branch*, escolha **main** e **/ (root)** → **Save**.
7. Espere 1–2 minutos e atualize. Vai aparecer: *"Your site is live at `https://SEUUSUARIO.github.io/meu-bolso/`"*.

## Passo 6 — Autorizar o endereço no Firebase

1. Firebase → **Authentication → Configurações → Domínios autorizados**.
2. **Adicionar domínio** → digite `SEUUSUARIO.github.io` (sem `https://` e sem `/meu-bolso`) → Adicionar.

Pronto! Abra o endereço, escolha um **apelido** e uma **senha**, toque em **Criar conta** e use os mesmos no celular e no computador. Guarde bem a senha: como não existe e-mail de verdade, ela não pode ser recuperada.

## Passo 7 — Instalar no celular

- **Android (Chrome):** abra o endereço → menu **⋮** → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari):** abra o endereço → botão **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.

O ícone aparece na tela inicial e abre em tela cheia, como um app normal.

---

## Usar em dupla (compartilhar a planilha)

1. No seu app: **Ajustes → Compartilhar planilha → Copiar link de convite**. No celular, ele já abre o menu para mandar pelo WhatsApp.
2. A outra pessoa abre o link, escolhe o **apelido e a senha dela** e toca em **Criar conta**.
3. Ela entra direto na mesma planilha. A partir daí, os dois veem e lançam tudo em tempo real.
4. Depois que ela entrar, desmarque **"Aceitar novas pessoas pelo link"**. Assim o link para de funcionar para qualquer outra pessoa.

Cada um tem o seu tema, e cada lançamento mostra quem lançou (ex: "Nubank · você"). Em Ajustes dá para mudar seu nome, remover alguém ou sair da planilha.

## Como usar

- **Botão +** → digite o valor (os centavos entram sozinhos: `7300` vira R$ 73,00) → descrição → categoria → cartão → **Salvar**.
- Quando você digita uma descrição que já usou antes (ex: "Uber"), o app já escolhe a mesma categoria e o mesmo cartão.
- **Parcelas:** use o **+/−**. Dá pra informar o *valor total* ou o *valor de cada parcela*. O app cria 1/3, 2/3, 3/3 nas próximas faturas.
- **Entrada:** renda extra de um mês só (freela, Pix recebido...). As rendas fixas ficam em **Ajustes → Rendas mensais**.
- **Fixo mensal:** assinaturas e contas que se repetem (Spotify, celular...). Aparecem em todos os meses. Para cancelar, abra o gasto e escolha **Encerrar**: ele some daquele mês em diante e o histórico fica.
- **Mês da fatura:** em **Ajustes → Contas e cartões**, configure o dia em que cada fatura **fecha** e o dia em que ela **vence**. O app joga cada compra na fatura certa.
- **Tema:** em **Ajustes → Aparência**, escolha **Escuro** ou **Pih ♡**.
- **Backup:** em **Ajustes → Dados**, exporte o mês em CSV (abre no Google Planilhas e no Excel) ou baixe um backup completo.
- **Sem internet:** dá pra lançar normalmente. Os dados sincronizam quando a conexão voltar.

Já deixei pré-cadastrados os dados da sua planilha: as categorias, as 3 fontes de renda e os 7 gastos fixos. Dá pra editar tudo em **Ajustes**.

---

## Como atualizar o app depois

1. No GitHub, abra o arquivo → ícone de lápis ✏️ → edite → **Commit changes** (ou envie o arquivo novo por *Add file → Upload files*).
2. Abra `sw.js` e aumente a versão: `meu-bolso-v1` → `meu-bolso-v2`. Assim os celulares baixam a versão nova.
3. No celular, feche o app e abra de novo (às vezes precisa fazer isso duas vezes).

## Problemas comuns

| Mensagem / sintoma | Solução |
|---|---|
| Aparece "demo" no canto | O `firebase-config.js` ainda está com `COLE_AQUI` (passo 4) |
| "Este endereço não está autorizado" | Faltou o passo 6 |
| "Sem permissão no banco" | Faltou publicar as regras (passo 3) |
| "Esse tipo de login não foi ativado" | Faltou o passo 2 |
| Esqueci a senha | Não dá para recuperar. Se a planilha for compartilhada: Firebase → Authentication → Usuários → ⋮ → **Excluir conta**, crie de novo com o mesmo apelido e peça um convite novo (os dados continuam na planilha). Se for só sua, os dados ficam presos na conta antiga, por isso baixe um backup de vez em quando (Ajustes → Dados) |
| Mudei algo e o celular não atualizou | Aumente a versão no `sw.js` e reabra o app |
| Site 404 no GitHub | Confira se o `index.html` está na raiz do repositório, e não dentro de uma subpasta |

## Custos

O plano gratuito do Firebase (Spark) permite 50 mil leituras e 20 mil gravações **por dia**. O uso pessoal fica muito abaixo disso. O GitHub Pages também é gratuito.
