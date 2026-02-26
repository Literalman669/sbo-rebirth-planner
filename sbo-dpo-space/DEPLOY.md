# Deploy to Hugging Face Space

## Option 1: Git push (automated)

From PowerShell, in the `sbo-dpo-space` folder:

```powershell
cd "c:\Users\OneBeyondTheWall\Downloads\pathofthesovereign-1.21.1\sbo-dpo-space"
.\deploy-to-hf.ps1
```

When Git asks for credentials:
- **Username:** `Bigtreeman669` (your HF username)
- **Password:** your [Hugging Face token](https://huggingface.co/settings/tokens) (with write access)

---

## Option 2: Files tab (browser)

1. Open your Space: https://huggingface.co/spaces/Bigtreeman669/SBORebirth
2. Click the **Files** tab (next to App, Community, Settings)
3. Click **Add file** → **Upload file**
4. Upload these 3 files (one at a time or drag-and-drop):
   - `Dockerfile`
   - `app.py`
   - `sbo_dataset.json`
5. Commit each upload (or add all 3, then commit together)

---

## Option 3: Create files in browser

On the **Files** tab, click **Add file** → **Create a new file**:

- Create `Dockerfile` – paste contents from `sbo-dpo-space/Dockerfile`
- Create `app.py` – paste contents from `sbo-dpo-space/app.py`
- Create `sbo_dataset.json` – open the local file, copy all, paste into the new file

Then commit.
