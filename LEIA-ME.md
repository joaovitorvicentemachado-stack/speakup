# Speak Up (Etapas 0, 1 e 2)

App instalável (PWA), 100% gratuito e offline: lições, revisão e progresso rodam **no seu aparelho**.
Não usa tokens do Claude nem assinatura.

- `index.html` → o app (Etapa 2): trilha, lições, revisão espaçada, estatísticas, ajustes.
- `laboratorio.html` → o teste de pronúncia ship × sheep (Etapas 0 e 1). Também abre por Ajustes → Ferramentas.

## Módulos da Etapa 2

| Arquivo | Função |
|---|---|
| `js/principal.js` | Rotas e barra de abas |
| `js/dados/curriculo.js` | **Conteúdo**: 6 unidades, 49 lições (edite aqui para criar lições) |
| `js/dados/nivelamento.js` | Teste de nível A1→B1 |
| `js/motor/gerador.js` | Cria os exercícios a partir do conteúdo |
| `js/motor/correcao.js` | Confere respostas (contrações, erros de digitação) |
| `js/motor/srs.js` | Repetição espaçada SM-2 |
| `js/motor/progresso.js` | Progresso salvo, exportar/importar |
| `js/motor/gamificacao.js` | XP, níveis, vidas, conquistas |
| `js/motor/voz.js` / `js/motor/fala.js` | Voz do navegador / ouvir e repetir |
| `js/ui/*.js`, `css/app.css` | Telas e visual |

## Etapa 1 (laboratório)

### Módulos do laboratório

| Arquivo | Função |
|---|---|
| `laboratorio.html`, `css/estilo.css` | Página do laboratório |
| `js/laboratorio.js` | Liga a página do laboratório aos módulos |
| `js/diagnostico.js` | Etapa 0: testa microfone, Groq, modelos e armazenamento |
| `js/audio.js` | Grava e converte para mono 16 kHz, corta silêncio |
| `js/fonemas.js` | **Ponto de troca do reconhecedor** (lista de motores) |
| `js/fonemas-worker.js` | Plano A: transformers.js + modelo `robg/speako-phoneme-recognizer` |
| `js/fonemas-servidor.js` | Plano B: conversa com o servidor Python do seu PC |
| `js/comparar.js` | Compara fonemas (ship × sheep), independente do modelo |
| `js/armazenamento.js` | Guarda resultados no aparelho |
| `js/pwa.js`, `sw.js`, `manifest.webmanifest` | Instalação, offline e multithread |
| `servidor-fonemas/` | Plano B em Python (veja o LEIA-ME de lá) |

## Opção 1: testar no PC agora, sem publicar (5 min)

O microfone só funciona em `https://` ou em `localhost`. No PC basta o Python que você já tem (o 3.14 serve para isso):

```powershell
cd caminho\para\ingles-app
py -m http.server 8080
```

Abra **http://localhost:8080** no Chrome ou Edge. Para parar: Ctrl+C no terminal.

## Opção 2: publicar grátis no GitHub Pages (PC + celular)

1. Crie uma conta em github.com (se ainda não tiver).
2. Clique em **New repository** → nome `pronuncia` → **Public** → **Create repository**.
3. Na página do repositório: **uploading an existing file** → arraste **todo o conteúdo** da pasta `ingles-app`
   (o `index.html` precisa ficar na raiz, não dentro de outra pasta) → **Commit changes**.
4. **Settings → Pages** → em *Source* escolha **Deploy from a branch** → branch **main**, pasta **/(root)** → **Save**.
5. Espere 1–2 min. O endereço será `https://SEU-USUARIO.github.io/pronuncia/`.
6. No Redmi 13, abra esse endereço no **Chrome** → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").

Para atualizar depois: faça upload dos arquivos novos no mesmo repositório; o app pega a versão nova na próxima abertura.

Alternativa ainda mais simples (sem conta no GitHub): app.netlify.com/drop → arraste a pasta `ingles-app`.

## Como fazer o teste

1. **Rodar verificação** (Etapa 0) e **Copiar relatório**.
2. Escolha o motor e **Baixar e carregar** (355 MB na 1ª vez; use Wi-Fi).
3. Fale a palavra mostrada, 10 vezes (5 ship + 5 sheep em ordem embaralhada).
4. **Copiar resultado para o Claude** e cole na conversa.
5. Se o resultado for ruim, use **Calibrar com áudio de um nativo**: se o modelo também errar o nativo, o problema é do modelo (vamos ao plano B); se acertar o nativo e errar o seu, o modelo está certo e o som é que precisa de treino.

## Problemas conhecidos

- **Multithread:** o `sw.js` ativa o "cross-origin isolation" sozinho (a página recarrega uma vez na 1ª visita). Se algo quebrar, abra com `?coi=0` no fim do endereço.
- **Celular:** o modelo ocupa ~0,7–1 GB de RAM enquanto roda. Feche outros apps se o Chrome recarregar a página.
- **Groq:** a Etapa 0 só confirma que a rede chega à API (resposta 401 sem chave = ok). A chave gratuita entra na próxima etapa.
