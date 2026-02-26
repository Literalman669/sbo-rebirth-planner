"""
SBO:Rebirth DPO Training Space
Train a DPO-aligned model for the SBO:Rebirth Build Planner AI advisor.
"""
import json
import os
import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM
from trl import DPOTrainer, DPOConfig
from peft import LoraConfig
import gradio as gr

# Configuration
MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
DATASET_PATH = "sbo_dataset.json"
OUTPUT_DIR = "./sbo-dpo-model"

# Load dataset (defer to avoid blocking app startup)
def _load_dataset():
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Dataset.from_list(data)

_dataset = None
def get_dataset():
    global _dataset
    if _dataset is None:
        print("Loading dataset...")
        _dataset = _load_dataset()
        print(f"Loaded {len(_dataset)} training examples")
    return _dataset

# Load model and tokenizer (lazy - on first train)
_model = None
_tokenizer = None


def get_model_and_tokenizer():
    global _model, _tokenizer
    if _model is None:
        print(f"Loading model: {MODEL_NAME}")
        _model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _tokenizer.pad_token = _tokenizer.eos_token
    return _model, _tokenizer


peft_config = LoraConfig(
    r=64,
    lora_alpha=16,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

training_args = DPOConfig(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
    learning_rate=5e-7,
    beta=0.1,
    max_length=1024,
    max_prompt_length=512,
    logging_steps=5,
    save_steps=50,
    save_total_limit=2,
    warmup_steps=50,
    optim="adamw_torch",
    lr_scheduler_type="cosine",
    loss_type="sigmoid",
    gradient_checkpointing=True,
    fp16=True,
    dataloader_num_workers=2,
    report_to="none",
)

_trainer = None


def train_model():
    try:
        ds = get_dataset()
        model, tokenizer = get_model_and_tokenizer()
        trainer = DPOTrainer(
            model=model,
            ref_model=None,
            args=training_args,
            train_dataset=ds,
            tokenizer=tokenizer,
            peft_config=peft_config,
        )
        print("Starting DPO training...")
        trainer.train()
        trainer.save_model()
        tokenizer.save_pretrained(OUTPUT_DIR)
        return (
            f"Training completed. Model saved to {OUTPUT_DIR}\n\n"
            f"Dataset: {len(ds)} examples | Base: {MODEL_NAME} | Epochs: {training_args.num_train_epochs}"
        )
    except Exception as e:
        import traceback
        return f"Training failed:\n{str(e)}\n\n{traceback.format_exc()}"


def test_model():
    if not os.path.exists(OUTPUT_DIR):
        return "Model not found. Train first."
    try:
        from peft import PeftModel
        model, tokenizer = get_model_and_tokenizer()
        model = PeftModel.from_pretrained(model, OUTPUT_DIR)
        test_prompt = "What's the boss of floor 4?"
        messages = [{"role": "user", "content": test_prompt}]
        inputs = tokenizer.apply_chat_template(
            messages, return_tensors="pt", add_generation_prompt=True
        ).to(model.device)
        with torch.no_grad():
            outputs = model.generate(
                inputs, max_new_tokens=80, temperature=0.3, do_sample=True, pad_token_id=tokenizer.eos_token_id
            )
        response = tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
        return f"Q: {test_prompt}\nA: {response.strip()}"
    except Exception as e:
        return f"Test failed: {str(e)}"


def create_interface():
    with gr.Blocks(title="SBO:Rebirth DPO Training") as demo:
        gr.Markdown("# SBO:Rebirth DPO Training")
        gr.Markdown("Train a DPO-aligned model for the SBO:Rebirth game advisor.")
        with gr.Row():
            with gr.Column():
                train_btn = gr.Button("Start Training", variant="primary")
                output_text = gr.Textbox(label="Status", lines=6)
            with gr.Column():
                test_btn = gr.Button("Test Model")
                test_output = gr.Textbox(label="Test Result", lines=4)
        train_btn.click(train_model, outputs=output_text)
        test_btn.click(test_model, outputs=test_output)
        gr.Markdown("**Dataset:** 167 pairs | **Model:** " + MODEL_NAME)
    return demo


if __name__ == "__main__":
    demo = create_interface()
    demo.launch(server_name="0.0.0.0", server_port=7860)
