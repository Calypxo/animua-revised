# Cloud Run model packaging

The production image must contain the two fine-tuned task directories. The
models stay outside Git and are staged from a private Google Cloud Storage
bucket by `cloudbuild.yaml` before the Docker build.

## Versioned private bucket layout

Use this versioned prefix, replacing `<project-id>` with the Google Cloud
project ID:

```text
gs://<project-id>-animua-private-models/animua-sentiment/roberta/roberta-tagalog-finetuned-2026-08-11-v1/
  sentiment/
  category/
```

Each task directory must contain exactly these runtime assets:

```text
config.json
labels.json
merges.txt
model.safetensors
special_tokens_map.json
tokenizer.json
tokenizer_config.json
vocab.json
```

`training_args.bin` and `training_results.json` are not required for inference.
The expected SHA-256 hashes are recorded in `model-manifest.sha256` and are
verified before the image build.

## Upload models

After creating a private bucket, upload the existing local task directories.
These commands are documentation only and have not been run:

```bash
MODEL_BUCKET="<project-id>-animua-private-models"
MODEL_VERSION="roberta-tagalog-finetuned-2026-08-11-v1"

gcloud storage rsync --recursive \
  models/roberta/sentiment \
  "gs://${MODEL_BUCKET}/animua-sentiment/roberta/${MODEL_VERSION}/sentiment"

gcloud storage rsync --recursive \
  models/roberta/category \
  "gs://${MODEL_BUCKET}/animua-sentiment/roberta/${MODEL_VERSION}/category"
```

Grant the Cloud Build service account `roles/storage.objectViewer` on the model
bucket. The build account also needs permission to write to the configured
Artifact Registry repository.

## Build without uploading local model files

Run from this directory after the bucket and Artifact Registry repository
exist:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

`.gcloudignore` deliberately excludes the local `models/` directory. Cloud
Build downloads the versioned private artifacts, verifies their checksums, and
then Docker copies them into the image. The runtime has Hugging Face offline
mode enabled, so it cannot substitute the base checkpoint or download model
files during a cold start.

The Cloud Run service should start the image with its Docker command, allocate
at least 2 GiB of memory, use one worker and low initial concurrency, and use
`GET /health` for transformer readiness checks.
