#!/usr/bin/env python3
"""
youtube_cookie_audio.py
Download audio from YouTube videos using browser cookies and yt-dlp,
with automatic fallback to Android VR client if browser cookie authentication
triggers YouTube SABR/403 restrictions.
"""

import argparse
import os
import sys
import yt_dlp

def download_audio(urls, browser=None, cookies_file=None, audio_format="mp3", quality="192", output_dir="audio-output", template="%(title)s [%(id)s].%(ext)s", player_client="android_vr,web"):
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, template)

    clients = [c.strip() for c in player_client.split(",") if c.strip()]

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'extractor_args': {
            'youtube': {
                'player_client': clients,
            }
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': audio_format,
            'preferredquality': quality,
        }],
        'quiet': False,
        'no_warnings': False,
    }

    if cookies_file:
        ydl_opts['cookiefile'] = cookies_file
    elif browser:
        browser_tuple = tuple(browser.split(':'))
        ydl_opts['cookiesfrombrowser'] = browser_tuple

    print(f"Downloading {len(urls)} URL(s)...")
    print(f"  Output directory: {os.path.abspath(output_dir)}")
    print(f"  Audio format    : {audio_format} ({quality} kbps/quality)")
    if cookies_file:
        print(f"  Cookies file    : {cookies_file}")
    elif browser:
        print(f"  Browser cookies : {browser}")
    print("-" * 50)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.download(urls)
    except yt_dlp.utils.DownloadError as de:
        err_msg = str(de)
        print(f"\n[!] Initial download attempt failed: {err_msg}", file=sys.stderr)
        
        # If browser cookies failed due to 403 or SABR streaming limits, attempt fallback without browser cookies
        if browser or cookies_file:
            print("[!] YouTube restricted the browser cookie session (SABR/403).", file=sys.stderr)
            print("[!] Retrying download using fallback player client without cookies...\n", file=sys.stderr)
            
            fallback_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_path,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android_vr', 'web'],
                    }
                },
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': audio_format,
                    'preferredquality': quality,
                }],
                'quiet': False,
                'no_warnings': False,
            }
            with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                return ydl.download(urls)
        raise

def main():
    parser = argparse.ArgumentParser(
        description="Download audio from YouTube videos using browser cookies and yt-dlp."
    )
    parser.add_argument(
        "urls",
        nargs="+",
        help="One or more YouTube URLs or video IDs."
    )
    parser.add_argument(
        "--browser", "-b",
        default="chrome",
        help="Browser to extract cookies from (e.g. chrome, firefox, safari, edge, brave, opera). Default: chrome"
    )
    parser.add_argument(
        "--cookies", "-c",
        default=None,
        help="Path to cookies file (e.g. cookies.txt). Takes precedence over --browser if specified."
    )
    parser.add_argument(
        "--format", "-f",
        dest="audio_format",
        default="mp3",
        help="Preferred audio format (e.g. mp3, m4a, wav, flac, opus, aac). Default: mp3"
    )
    parser.add_argument(
        "--quality", "-q",
        default="192",
        help="Audio quality specification for VBR/CBR (e.g. 0 for best VBR, 192 or 320 for kbps). Default: 192"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="audio-output",
        help="Directory where downloaded audio files will be stored. Default: audio-output"
    )
    parser.add_argument(
        "--player-client",
        default="android_vr,web",
        help="YouTube player client(s) to use. Default: android_vr,web"
    )
    parser.add_argument(
        "--template",
        default="%(title)s [%(id)s].%(ext)s",
        help="Output filename template. Default: '%(title)s [%(id)s].%(ext)s'"
    )

    args = parser.parse_args()

    try:
        code = download_audio(
            urls=args.urls,
            browser=args.browser,
            cookies_file=args.cookies,
            audio_format=args.audio_format,
            quality=args.quality,
            output_dir=args.output_dir,
            template=args.template,
            player_client=args.player_client
        )
        sys.exit(code)
    except Exception as e:
        print(f"\n[X] Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
