# Video Subtitle Translator

A tool that transcribes speech from video files, generates subtitles, and translates them into different languages. It supports video trimming, subtitle generation, translation, and subtitle embedding.

## Prerequisites

### macOS

Install required system dependencies using Homebrew:

```bash
# Install FFmpeg for video processing
brew install ffmpeg

# Install yt-dlp for YouTube video downloading
brew install yt-dlp
```

### Linux (Ubuntu/Debian)

```bash
# Install FFmpeg
sudo apt update
sudo apt install ffmpeg

# Install yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Windows

1. Install FFmpeg:

   - Download from [FFmpeg official website](https://ffmpeg.org/download.html)
   - Add FFmpeg to system PATH

2. Install yt-dlp:
   - Install using pip: `pip install yt-dlp`
   - Or download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases)

## Installation

```bash
npm install
```

## Build

The project uses TypeScript and needs to be built before running in production mode:

```bash
npm run build
```

This will compile TypeScript files into JavaScript in the `dist` directory.

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

### 1. YouTube Video Download

Download a YouTube video in highest quality:

```bash
npm run download_youtube <youtube_url>
```

Example:

```bash
npm run download_youtube https://www.youtube.com/watch?v=example
```

This command will:

1. Download the highest quality video stream
2. Download the highest quality audio stream
3. Merge them into a single MP4 file
4. Save the result in the `output` directory

### 2. Video Translation

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

### 3. Video Trimming

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

### 4. Subtitle Embedding

Embed subtitle file into a video:

```bash
npm run merge_subtitle <input_video> <subtitle_file> <output_video>
```

Example:

```bash
npm run merge_subtitle "./input/video.mp4" "./subtitles/subs.srt" "./output/video_with_subs.mp4"
```

### 5. SRT File Translation

Translate an existing SRT subtitle file:

```bash
npm run translate_srt <input_srt_file>
```

Example:

```bash
npm run translate_srt "./subtitles/original.srt"
```

## Processing Large Videos

For videos longer than 10 minutes, the tool automatically:

1. Splits the video into 10-minute chunks
2. Processes each chunk in parallel using Worker Threads
3. Combines the results

This approach:

- Reduces memory usage
- Improves stability and performance through parallel processing
- Allows for better error handling
- Shows detailed progress for each chunk

## Cautions

- Never commit the `.env` file to Git
- Keep your API keys secure and rotate them periodically
- MP4 format is recommended for input videos
- Ensure you have sufficient disk space for temporary files
- For long videos, expect the process to take significant time
