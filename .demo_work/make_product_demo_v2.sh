#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
cd "$ROOT"
OUT_DIR="$ROOT/product-demo"
WORK_DIR="$ROOT/.demo_work"
AUDIO="$ROOT/audio-output/RAYE - WHERE IS MY HUSBAND! (Lyrics) [gzjVn9UhaRE].mp3"

for input in \
  "$AUDIO" \
  "$WORK_DIR/assets/tay_demo_reference.png" \
  "$WORK_DIR/screens/landing.png" \
  "$WORK_DIR/screens/desktop.png" \
  "$WORK_DIR/assets/candidate_review_boundary.mp4" \
  "$WORK_DIR/assets/submission_receipt.mp4" \
  "$ROOT/public/animations/candidate-review-loop.mp4"; do
  test -f "$input" || { echo "Missing required input: $input" >&2; exit 1; }
done
for caption in "$WORK_DIR"/captions/caption_{01,02,03,04,05,06,07,08,09}.png; do
  test -f "$caption" || { echo "Missing caption overlay: $caption" >&2; exit 1; }
done
mkdir -p "$OUT_DIR"

ffmpeg -y \
  -loop 1 -framerate 30 -t 6 -i "$WORK_DIR/assets/tay_demo_reference.png" \
  -loop 1 -framerate 30 -t 8 -i "$WORK_DIR/screens/landing.png" \
  -i "$WORK_DIR/assets/candidate_review_boundary.mp4" \
  -loop 1 -framerate 30 -t 9 -i "$WORK_DIR/screens/desktop.png" \
  -i "$WORK_DIR/assets/submission_receipt.mp4" \
  -loop 1 -framerate 30 -t 6 -i "$WORK_DIR/screens/landing.png" \
  -stream_loop -1 -i "$ROOT/public/animations/candidate-review-loop.mp4" \
  -loop 1 -framerate 30 -t 6 -i "$WORK_DIR/assets/tay_demo_reference.png" \
  -loop 1 -framerate 30 -t 4 -i "$WORK_DIR/assets/tay_demo_reference.png" \
  -loop 1 -framerate 30 -t 6 -i "$WORK_DIR/captions/caption_01.png" \
  -loop 1 -framerate 30 -t 8 -i "$WORK_DIR/captions/caption_02.png" \
  -loop 1 -framerate 30 -t 8 -i "$WORK_DIR/captions/caption_03.png" \
  -loop 1 -framerate 30 -t 9 -i "$WORK_DIR/captions/caption_04.png" \
  -loop 1 -framerate 30 -t 9 -i "$WORK_DIR/captions/caption_05.png" \
  -loop 1 -framerate 30 -t 6 -i "$WORK_DIR/captions/caption_06.png" \
  -loop 1 -framerate 30 -t 4 -i "$WORK_DIR/captions/caption_07.png" \
  -loop 1 -framerate 30 -t 6 -i "$WORK_DIR/captions/caption_08.png" \
  -loop 1 -framerate 30 -t 4 -i "$WORK_DIR/captions/caption_09.png" \
  -ss 42 -t 60 -i "$AUDIO" \
  -filter_complex "
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00042,1.08)':d=180:s=1920x1080:fps=30,trim=duration=6,setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=1920:h=1080:color=0x060E1F@0.18:t=fill[b0];
[1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00033,1.06)':d=240:s=1920x1080:fps=30,trim=duration=8,setpts=PTS-STARTPTS[b1];
[2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060E1F,fps=30,trim=duration=8,setpts=PTS-STARTPTS[b2];
[3:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00028,1.05)':d=270:s=1920x1080:fps=30,trim=duration=9,setpts=PTS-STARTPTS[b3];
[4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060E1F,fps=30,trim=duration=9,setpts=PTS-STARTPTS[b4];
[5:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00032,1.06)':d=180:s=1920x1080:fps=30,trim=duration=6,setpts=PTS-STARTPTS[b5];
[6:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060E1F,fps=30,trim=duration=4,setpts=PTS-STARTPTS[b6];
[7:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00036,1.07)':d=180:s=1920x1080:fps=30,trim=duration=6,setpts=PTS-STARTPTS[b7];
[8:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00032,1.05)':d=120:s=1920x1080:fps=30,trim=duration=4,setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=1920:h=1080:color=0x060E1F@0.24:t=fill[b8];
[9:v]format=rgba,trim=duration=6,setpts=PTS-STARTPTS[c0];
[10:v]format=rgba,trim=duration=8,setpts=PTS-STARTPTS[c1];
[11:v]format=rgba,trim=duration=8,setpts=PTS-STARTPTS[c2];
[12:v]format=rgba,trim=duration=9,setpts=PTS-STARTPTS[c3];
[13:v]format=rgba,trim=duration=9,setpts=PTS-STARTPTS[c4];
[14:v]format=rgba,trim=duration=6,setpts=PTS-STARTPTS[c5];
[15:v]format=rgba,trim=duration=4,setpts=PTS-STARTPTS[c6];
[16:v]format=rgba,trim=duration=6,setpts=PTS-STARTPTS[c7];
[17:v]format=rgba,trim=duration=4,setpts=PTS-STARTPTS[c8];
[b0][c0]overlay=0:0:shortest=1[v0];
[b1][c1]overlay=0:0:shortest=1[v1];
[b2][c2]overlay=0:0:shortest=1[v2];
[b3][c3]overlay=0:0:shortest=1[v3];
[b4][c4]overlay=0:0:shortest=1[v4];
[b5][c5]overlay=0:0:shortest=1[v5];
[b6][c6]overlay=0:0:shortest=1[v6];
[b7][c7]overlay=0:0:shortest=1[v7];
[b8][c8]overlay=0:0:shortest=1[v8];
[v0][v1][v2][v3][v4][v5][v6][v7][v8]concat=n=9:v=1:a=0,format=yuv420p[v];
[18:a]atrim=duration=60,asetpts=PTS-STARTPTS,volume=0.42,afade=t=in:st=0:d=1.0,afade=t=out:st=57:d=3.0[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -movflags +faststart \
  -t 60 "$OUT_DIR/Job_Tayari_Product_Demo_60s.mp4"

ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,codec_type,width,height,r_frame_rate -of json "$OUT_DIR/Job_Tayari_Product_Demo_60s.mp4"
