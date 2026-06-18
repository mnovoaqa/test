# How to actually use VOXFORGE

You said you want to use this app yourself. Pick the easiest path for you below.

---

## Option 1 — Docker Desktop (easiest, no Python required)

Best if you don't know Python.

1. Install **Docker Desktop** from https://docker.com (free, ~10 min install).
2. Download this repo as a ZIP from GitHub and unzip it (or use `git clone`).
3. Open a terminal in the `voxforge/` folder and run:
   ```bash
   docker build -t voxforge .
   docker run --rm -p 7860:7860 voxforge
   ```
4. Open **http://localhost:7860** in your browser.
5. Upload your vocal, hit "MAKE IT SOUND PRO", get a song back.

When you're done, close the terminal. Run the `docker run` line again next time you want to use it.

---

## Option 2 — One-command script (if you already have Python 3.10+)

Easiest if you've used Python before.

```bash
cd voxforge
./run.sh
```

That creates a venv, installs everything, and opens the UI at http://localhost:7860.

On **Windows**, do this once instead:

```powershell
cd voxforge
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install gradio
python app.py
```

Then open http://localhost:7860.

---

## Option 3 — Hugging Face Spaces (free public hosting, requires HF account)

Best if you want a permanent URL you can use from your phone.

1. Make a free account at https://huggingface.co.
2. Create a new **Space**, choose the **Gradio** SDK and CPU hardware (free).
3. Upload everything in `voxforge/` (the `voxforge/` package, `app.py`, `requirements.txt`).
4. Add `gradio>=6.0` to `requirements.txt` if it isn't already.
5. HF builds it automatically. You'll get a URL like `https://huggingface.co/spaces/yourname/voxforge` that works from any device.

The first cold start takes ~30 seconds because the audio libraries are large.

---

## Option 4 — I run one song for you here

Drop a vocal (WAV/MP3/M4A) into our chat and tell me which genre + tune style. I'll process it in this session and hand back the finished WAV. One-off only — this environment doesn't persist.

---

## Recording tips (for any path above)

- Quiet room, no fans/AC.
- Mic 6–8 inches (15–20 cm) from your mouth.
- Wired headphones, no monitor speakers (avoids bleed).
- Aim for peaks around −12 to −6 dBFS (orange, not red on your meter).
- Phone Voice Memos works, but USB mic is meaningfully better.
- Record one performance per take — overdubs come in V1.
