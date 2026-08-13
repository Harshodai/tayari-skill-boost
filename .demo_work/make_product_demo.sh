#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
cd "$ROOT"

OUT_DIR="$ROOT/product-demo"
WORK_DIR="$ROOT/.demo_work"
FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
AUDIO="$ROOT/audio-output/RAYE - WHERE IS MY HUSBAND! (Lyrics) [gzjVn9UhaRE].mp3"

for input in \
  "$FONT" \
  "$AUDIO" \
  "$WORK_DIR/assets/tay_demo_reference.png" \
  "$WORK_DIR/screens/landing.png" \
  "$WORK_DIR/screens/desktop.png" \
  "$WORK_DIR/assets/candidate_review_boundary.mp4" \
  "$WORK_DIR/assets/submission_receipt.mp4" \
  "$ROOT/public/animations/candidate-review-loop.mp4"; do
  test -f "$input" || { echo "Missing required input: $input" >&2; exit 1; }
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
  -ss 42 -t 60 -i "$AUDIO" \
  -filter_complex "
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00042,1.08)':d=180:s=1920x1080:fps=30,trim=duration=6,setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=1920:h=1080:color=0x060E1F@0.18:t=fill,drawbox=x=120:y=846:w=1020:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='JOB SEARCH GETS NOISY.':fontcolor=white:fontsize=48:x=150:y=885[v0];
[1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00033,1.06)':d=240:s=1920x1080:fps=30,trim=duration=8,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=1340:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='KEEP EVERY IMPORTANT ACTION IN VIEW.':fontcolor=white:fontsize=42:x=150:y=892[v1];
[2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060E1F,fps=30,trim=duration=8,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=850:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='PREPARE. REVIEW. DECIDE.':fontcolor=white:fontsize=43:x=150:y=892[v2];
[3:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00028,1.05)':d=270:s=1920x1080:fps=30,trim=duration=9,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=1500:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='NOTHING GOES OUT WITHOUT YOUR APPROVAL.':fontcolor=white:fontsize=40:x=150:y=894[v3];
[4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060E1F,fps=30,trim=duration=9,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=1160:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='EVERY ATTEMPT LEAVES A RECEIPT.':fontcolor=white:fontsize=42:x=150:y=892[v4];
[5:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00032,1.06)':d=180:s=1920x1080:fps=30,trim=duration=6,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=1350:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='ONE FOCUSED SYSTEM FOR THE SEARCH.':fontcolor=white:fontsize=42:x=150:y=892[v5];
[6:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060E1F,fps=30,trim=duration=4,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=1040:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='WORK WITH A CLEAR RECORD.':fontcolor=white:fontsize=43:x=150:y=892[v6];
[7:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00036,1.07)':d=180:s=1920x1080:fps=30,trim=duration=6,setpts=PTS-STARTPTS,drawbox=x=120:y=846:w=950:h=138:color=0x060E1F@0.82:t=fill,drawtext=fontfile='$FONT':text='LESS CHASING. MORE CLARITY.':fontcolor=white:fontsize=43:x=150:y=892[v7];
[8:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00032,1.05)':d=120:s=1920x1080:fps=30,trim=duration=4,setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=1920:h=1080:color=0x060E1F@0.24:t=fill,drawbox=x=120:y=814:w=1260:h=182:color=0x060E1F@0.86:t=fill,drawtext=fontfile='$FONT':text='JOB TAYARI':fontcolor=white:fontsize=54:x=150:y=850,drawtext=fontfile='$FONT':text='A SEARCH YOU CAN INSPECT.':fontcolor=0x35D5FF:fontsize=32:x=153:y=918[v8];
[v0][v1][v2][v3][v4][v5][v6][v7][v8]concat=n=9:v=1:a=0,format=yuv420p[v];
[9:a]atrim=duration=60,asetpts=PTS-STARTPTS,volume=0.42,afade=t=in:st=0:d=1.0,afade=t=out:st=57:d=3.0[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -movflags +faststart \
  -t 60 "$OUT_DIR/Job_Tayari_Product_Demo_60s.mp4"

ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,codec_type,width,height,r_frame_rate -of json "$OUT_DIR/Job_Tayari_Product_Demo_60s.mp4"
