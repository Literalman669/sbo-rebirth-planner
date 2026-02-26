FROM huggingface/transformers-pytorch-gpu:latest

# HF Spaces: user for Dev Mode and permissions
RUN useradd -m -u 1000 user
WORKDIR /app

# Install TRL and dependencies
RUN pip install --no-cache-dir \
    trl[peft] \
    transformers \
    datasets \
    accelerate \
    peft \
    bitsandbytes \
    gradio \
    spaces

# Copy files
COPY --chown=user app.py sbo_dataset.json .

USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH

EXPOSE 7860
CMD ["python", "app.py"]
