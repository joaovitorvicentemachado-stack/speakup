# Plano B: servidor de fonemas no seu PC

Use só se o modelo do navegador (plano A) **não** distinguir ship × sheep, inclusive com o áudio nativo.
Funciona no PC. No celular não (o celular não alcança o `localhost` do PC pela página https).

## Instalação (uma vez, ~10 min + download de ~2 GB)

Seu Python é o 3.14, e o PyTorch pode não ter versão para ele. Em vez de desinstalar nada,
use o **uv**, que baixa um Python 3.12 só para esta pasta:

```powershell
# 1. Instalar o uv (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 2. Na pasta servidor-fonemas, criar o ambiente com Python 3.12
cd caminho\para\ingles-app\servidor-fonemas
uv venv --python 3.12
uv pip install --python .venv torch --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv transformers huggingface_hub numpy
```

## Uso

```powershell
cd caminho\para\ingles-app\servidor-fonemas
.venv\Scripts\python servidor.py
```

Quando aparecer `Pronto!`, abra o Laboratório de Pronúncia no PC, escolha
**"Servidor local no PC"** no campo Motor e clique em **Baixar e carregar**.

## Se der erro

- `No matching distribution found for torch`: confira se o ambiente é 3.12 (`.venv\Scripts\python --version`).
- A página diz que o servidor não respondeu: o terminal com o `servidor.py` precisa estar aberto.
- Navegador bloqueou a chamada: teste abrindo a página pelo `localhost` (veja o LEIA-ME principal, "Testar no PC sem publicar").
