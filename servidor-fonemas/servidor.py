"""
PLANO B — servidor local de fonemas (roda no SEU PC, grátis, sem internet depois do 1º download).

Modelo: facebook/wav2vec2-lv-60-espeak-cv-ft (~1,2 GB), saída em IPA do espeak,
com marca de duração (ex.: "ʃ iː p"), mais rico que o modelo do navegador.

Por que Python 3.12 e não o seu 3.14: o PyTorch costuma demorar para publicar
versões para o Python mais novo. Com o `uv` você cria um ambiente 3.12 isolado
sem mexer no Python 3.14 instalado. Passo a passo em LEIA-ME.md.

Contrato (o mesmo que js/fonemas-servidor.js espera):
  GET  /saude    -> {"modelo": ..., "dispositivo": ...}
  POST /fonemas  corpo = Float32 little-endian, mono, 16 kHz -> {"ipa": "...", "ms": ...}
"""

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import torch
from huggingface_hub import hf_hub_download
from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC

MODELO = "facebook/wav2vec2-lv-60-espeak-cv-ft"
PORTA = 8765

print(f"Carregando {MODELO} (na 1ª vez baixa ~1,2 GB)...")
extrator = Wav2Vec2FeatureExtractor.from_pretrained(MODELO)
modelo = Wav2Vec2ForCTC.from_pretrained(MODELO).eval()
torch.set_num_threads(max(1, torch.get_num_threads()))

# Decodificação CTC feita à mão a partir do vocab.json: assim NÃO precisamos
# do pacote "phonemizer" nem do espeak instalado no Windows.
with open(hf_hub_download(MODELO, "vocab.json"), encoding="utf-8") as f:
    vocab = json.load(f)
id_para_simbolo = {i: s for s, i in vocab.items()}
ESPECIAIS = {"<pad>", "<s>", "</s>", "<unk>", "|"}
ID_PAD = vocab.get("<pad>", 0)


def reconhecer(amostras: np.ndarray) -> str:
    entrada = extrator(amostras, sampling_rate=16000, return_tensors="pt")
    with torch.inference_mode():
        logits = modelo(entrada.input_values).logits[0]
    ids = logits.argmax(-1).tolist()
    saida, anterior = [], None
    for i in ids:  # junta repetições e remove o "branco" do CTC
        if i != anterior and i != ID_PAD:
            s = id_para_simbolo.get(i, "")
            if s and s not in ESPECIAIS:
                saida.append(s)
        anterior = i
    return " ".join(saida)


# Aquece o modelo (a primeira inferência é sempre lenta).
reconhecer(np.zeros(16000, dtype=np.float32))


class Handler(BaseHTTPRequestHandler):
    def _cabecalhos(self, status=200, tipo="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        # Permite que a página (GitHub Pages ou localhost) chame este servidor.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.end_headers()

    def do_OPTIONS(self):
        self._cabecalhos(204)

    def do_GET(self):
        if self.path == "/saude":
            self._cabecalhos()
            self.wfile.write(json.dumps({"modelo": MODELO, "dispositivo": "CPU (PyTorch)"}).encode())
        else:
            self._cabecalhos(404)

    def do_POST(self):
        if self.path != "/fonemas":
            return self._cabecalhos(404)
        tamanho = int(self.headers.get("Content-Length", 0))
        amostras = np.frombuffer(self.rfile.read(tamanho), dtype="<f4").copy()
        t0 = time.perf_counter()
        ipa = reconhecer(amostras)
        ms = (time.perf_counter() - t0) * 1000
        self._cabecalhos()
        self.wfile.write(json.dumps({"ipa": ipa, "ms": ms}, ensure_ascii=False).encode())
        print(f"{len(amostras) / 16000:.1f}s de áudio -> /{ipa}/ em {ms:.0f} ms")


if __name__ == "__main__":
    print(f"Pronto! Servidor em http://localhost:{PORTA}  (Ctrl+C para parar)")
    ThreadingHTTPServer(("127.0.0.1", PORTA), Handler).serve_forever()
