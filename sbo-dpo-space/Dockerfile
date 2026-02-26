FROM huggingface/transformers-pytorch-gpu:latest

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

# Set working directory
WORKDIR /app

# Copy files
COPY app.py .
COPY sbo_dataset.json .

# Expose port for Gradio
EXPOSE 7860

CMD ["python", "app.py"]
