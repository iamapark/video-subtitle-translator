# Video Subtitle Translator

A tool that transcribes speech from video files, generates subtitles, and translates them into different languages. It supports video trimming, subtitle generation, translation, and subtitle embedding.

## Installation

```bash
npm install
```

## Environment Setup

1. Copy the `.env.sample` file to `.env`:

```bash
cp .env.sample .env
```

2. Configure the following values in your `.env` file:

### Google Cloud Configuration

- `GOOGLE_STORAGE_BUCKET`: Your Google Cloud Storage bucket name
- `RECOGNIZER_NAME`: Speech-to-Text Recognizer name (e.g., "projects/your-project-number/locations/global/recognizers/\_")
- `GOOGLE_PROJECT_ID`: Your Google Cloud project ID

### Gemini API Configuration

- `GEMINI_API_KEY`: Gemini API key from Google AI Studio
- `GEMINI_MODEL_NAME`: Gemini model name to use (default: "gemini-1.5-pro-latest")

## Required API Keys and Permissions

1. Google Cloud Platform

   - Enable Speech-to-Text API
   - Enable Cloud Storage API
   - Create a service account and generate key
   - Required IAM permissions:
     - Speech-to-Text Recognizer access
     - Cloud Storage object read/write access

2. Gemini API
   - Get API key from Google AI Studio (https://aistudio.google.com/app/apikey)

## Usage

### 1. Video Translation

Transcribe speech from a video, translate it, and generate subtitles:

```bash
npm run translate <input_video> <output_directory>
```

Example:

```bash
npm run translate ./input/video.mp4 ./output
```

This command will:

1. Extract audio from the video
2. Transcribe the speech to text
3. Translate the text
4. Generate subtitle file

### 2. Video Trimming

Trim a video file to a specific time range:

```bash
npm run trim <input_video> <output_video> <time_range>
```

Example:

```bash
# Trim video from 3 minutes to 5 minutes
npm run trim "./input/video.mp4" "./output/trimmed.mp4" "3~5"

# Trim video from 3 minutes to the end
npm run trim "./input/video.mp4" "./output/trimmed.mp4" "3~"
```

Parameters:

- `time_range`: Format is "start~end" in minutes (e.g., "3~5" or "3~")

### 3. Subtitle Embedding

Embed subtitle file into a video:

```bash
npm run merge_subtitle <input_video> <subtitle_file> <output_video>
```

Example:

```bash
npm run merge_subtitle "./input/video.mp4" "./subtitles/subs.srt" "./output/video_with_subs.mp4"
```

## Processing Large Videos

For videos longer than 10 minutes, the tool automatically:

1. Splits the video into 10-minute chunks
2. Processes each chunk separately
3. Combines the results

This approach:

- Reduces memory usage
- Improves stability
- Allows for better error handling
- Shows detailed progress for each chunk

## Cautions

- Never commit the `.env` file to Git
- Keep your API keys secure and rotate them periodically
- MP4 format is recommended for input videos
- Ensure you have sufficient disk space for temporary files
- For long videos, expect the process to take significant time
