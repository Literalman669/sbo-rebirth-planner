# SBO:Rebirth DPO Training Space

Train a DPO-aligned model for the **SBO:Rebirth Build Planner** AI advisor using Hugging Face Spaces.

## What's Included

- **Dockerfile** – GPU base image with TRL, transformers, datasets, PEFT
- **app.py** – Gradio UI to run DPO training and test the model
- **sbo_dataset.json** – 167 preference pairs (boss facts, stat formulas, build advice) in TRL format

## Upload to Hugging Face

1. **Create a new Space**
   - Go to [huggingface.co/new-space](https://huggingface.co/new-space)
   - Name it (e.g. `sbo-rebirth-dpo-trainer`)
   - Select **Docker** as SDK

2. **Upload files**
   - Upload these files to the Space root:
     - `Dockerfile`
     - `app.py`
     - `sbo_dataset.json`
   - Or clone the Space repo and push:
     ```bash
     git clone https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
     cd YOUR_SPACE_NAME
     # Copy Dockerfile, app.py, sbo_dataset.json here
     git add . && git commit -m "Add DPO training files" && git push
     ```

3. **Set Hardware**
   - In Space Settings → **Settings** → **Hardware**, choose **GPU** (T4 or better recommended)
   - The Space needs GPU to train; CPU will be very slow or OOM.

4. **Run**
   - The Space will build and launch the Gradio app
   - Click **Start Training** to begin DPO training
   - When done, click **Test Model** to verify outputs

## Regenerating the Dataset

If you update boss data or formulas in the planner, regenerate the dataset:

```bash
cd sbo-rebirth-planner/scripts
node generate-dpo-dataset.js
# Copy the output to sbo-dpo-space:
copy sbo-dpo-dataset.json ..\..\sbo-dpo-space\sbo_dataset.json
```

## Notes

- **Model**: Uses `Qwen/Qwen2.5-7B-Instruct` as base; LoRA adapter saved to `./sbo-dpo-model`
- **Training**: 3 epochs, batch size 4 × grad accum 8 ≈ effective batch 32, learning rate 5e-7
- **Flash Attention**: Not used (default attention) for compatibility; add `attn_implementation="flash_attention_2"` if your GPU supports it
- After training, download `sbo-dpo-model` from the Space and use it with your Edge function or local inference
