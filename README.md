# Athos Licita — Site (Fase 1)

Site da plataforma Athos Licita com domínio próprio, lendo a planilha e o Drive
da sua conta Google através da conta de serviço.

## O que já funciona nesta versão
- Login com os MESMOS usuários e PINs de hoje (aba `Usuarios` da planilha)
- Dashboard geral: KPIs e status de certidões por empresa (abas `Empresas` e `Documentos`)

---

## Passo a passo para publicar (só na primeira vez)

### 1. Subir o projeto no GitHub (pelo navegador, sem instalar nada)
1. Entre em github.com logado na sua conta
2. Clique no **+** (canto superior direito) → **New repository**
3. Nome: `athos-licita` → marque **Private** → **Create repository**
4. Na página do repositório, clique em **uploading an existing file**
5. Arraste TODOS os arquivos e pastas deste projeto (app, lib, package.json, etc.)
   - ⚠️ NÃO envie o arquivo `.json` da conta de serviço — ele nunca vai para o GitHub
6. Clique em **Commit changes**

### 2. Conectar na Vercel
1. Entre em vercel.com (com o GitHub)
2. **Add New → Project** → escolha o repositório `athos-licita` → **Import**
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione as 4 variáveis:

| Nome | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `athos-licita-bot@gen-lang-client-0994620743.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Abra o arquivo `.json` baixado no Bloco de Notas, copie o valor do campo `"private_key"` INTEIRO (de `-----BEGIN PRIVATE KEY-----\n` até `-----END PRIVATE KEY-----\n`, com as barras `\n` mesmo) e cole aqui |
| `SHEET_ID` | O trecho da URL da planilha entre `/d/` e `/edit` |
| `SESSION_SECRET` | Qualquer frase longa e aleatória inventada por você |

4. Clique em **Deploy** e aguarde ~1 minuto
5. A Vercel mostra o link do site no ar (ex: `athos-licita.vercel.app`) — teste o login!

### 3. (Opcional) Domínio próprio
1. Registre `athoslicita.com.br` no registro.br
2. Na Vercel: **Settings → Domains → Add** → siga as instruções de DNS

---

## Como fazer alterações depois
1. Receba os arquivos atualizados
2. No GitHub, abra o arquivo → ícone de lápis (ou faça upload por cima) → **Commit**
3. A Vercel publica sozinha em ~1 minuto — pronto

## Rodar no seu computador (opcional, para testar)
```bash
npm install
cp .env.example .env.local   # e preencha os valores
npm run dev                  # abre em http://localhost:3000
```
