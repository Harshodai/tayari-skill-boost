import asyncio
import os
import json
import logging
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import httpx
import websockets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/interview", tags=["Voice Interview AI"])

DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Standard fillers list
FILLER_WORDS = ["um", "uh", "like", "you know", "so", "actually", "basically"]

async def synthesize_speech(text: str) -> bytes:
    """Synthesizes text to speech using OpenAI TTS API."""
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY is not set. Skipping speech synthesis.")
        return b""

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "tts-1",
        "input": text,
        "voice": "alloy",
        "response_format": "mp3"
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return resp.content
            else:
                logger.error(f"OpenAI TTS returned status {resp.status_code}: {resp.text}")
                return b""
    except Exception as e:
        logger.error(f"Error in speech synthesis: {e}")
        return b""

async def generate_llm_response(prompt: str, system_message: str) -> str:
    """Helper to query the LLM compatibly with the project's config."""
    from app.services.llm_service import llm_complete
    try:
        response = await llm_complete(
            system_message=system_message,
            user_message=prompt,
            max_tokens=300,
            temperature=0.7
        )
        return response
    except Exception as e:
        logger.error(f"Error generating LLM response: {e}")
        return "Thank you for that response. Let's move on to the next question."

def analyze_speech_telemetry(transcript: str, duration_seconds: float) -> Dict[str, Any]:
    """Analyzes WPM, filler words, and STAR compliance heuristics."""
    words = transcript.lower().split()
    word_count = len(words)
    
    # 1. Words Per Minute (WPM)
    duration_mins = max(duration_seconds, 1.0) / 60.0
    wpm = int(word_count / duration_mins)
    
    # 2. Filler words count
    fillers_found = []
    for word in words:
        # Check direct match or multi-word phrases
        if word in FILLER_WORDS:
            fillers_found.append(word)
    
    # 3. STAR Compliance simple heuristics
    # We look for transition indicator words or phases
    has_situation = any(w in words for w in ["when", "project", "time", "at", "role", "background"])
    has_task = any(w in words for w in ["task", "goal", "assigned", "required", "need"])
    has_action = any(w in words for w in ["i", "built", "wrote", "lead", "designed", "created", "refactored", "implemented", "resolved"])
    has_result = any(w in words for w in ["result", "metrics", "percent", "saved", "improved", "delivered", "outcome", "finally"])
    
    star_compliance = {
        "situation": has_situation,
        "task": has_task,
        "action": has_action,
        "result": has_result,
        "score": sum([has_situation, has_task, has_action, has_result]) * 25
    }
    
    return {
        "wpm": wpm,
        "word_count": word_count,
        "fillers": fillers_found,
        "filler_count": len(fillers_found),
        "star_compliance": star_compliance
    }

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Voice stream WebSocket connection accepted")

    target_role = "Software Engineer"
    company_name = "Target Company"
    interview_type = "behavioral"
    
    current_question = ""
    accumulated_transcript = []
    turn_start_time = 0.0

    try:
        # 1. Expect initial config frame
        init_data = await websocket.receive_text()
        try:
            config_payload = json.loads(init_data)
            if config_payload.get("type") == "start":
                target_role = config_payload.get("target_role", target_role)
                company_name = config_payload.get("company_name", company_name)
                interview_type = config_payload.get("interview_type", interview_type)
        except Exception as e:
            logger.warning(f"Failed to parse initialization payload: {e}")

        # Generate first question
        system_msg = "You are a professional mock interviewer. Keep questions concise and realistic."
        prompt = f"Generate the first interview question for a candidate interviewing for a {target_role} role at {company_name}."
        
        current_question = await generate_llm_response(prompt, system_msg)
        
        # Send text back to client
        await websocket.send_json({
            "type": "llm_text",
            "text": current_question
        })
        
        # Synthesize & stream initial question audio
        audio_bytes = await synthesize_speech(current_question)
        if audio_bytes:
            await websocket.send_bytes(audio_bytes)
            
        turn_start_time = time.time()

        if not DEEPGRAM_API_KEY:
            # =================================================================
            # Mock mode: handle text or dummy audio loops
            # =================================================================
            logger.warning("Deepgram API Key not set. Running in text-only fallback mode.")
            transcription_unavailable_sent = False
            while True:
                message = await websocket.receive()
                if "text" in message:
                    text_data = message["text"]
                    try:
                        payload = json.loads(text_data)
                        if payload.get("type") == "user_response":
                            user_text = payload.get("text", "")
                            # Perform analysis
                            duration = time.time() - turn_start_time
                            telemetry = analyze_speech_telemetry(user_text, duration)
                            
                            # Send telemetry
                            await websocket.send_json({
                                "type": "telemetry",
                                "wpm": telemetry["wpm"],
                                "fillers": telemetry["fillers"],
                                "star_compliance": telemetry["star_compliance"]
                            })

                            # Generate next question
                            prompt = f"The candidate responded: '{user_text}'. Now ask the next follow-up question for {target_role} at {company_name}."
                            next_q = await generate_llm_response(prompt, system_msg)
                            current_question = next_q

                            await websocket.send_json({
                                "type": "llm_text",
                                "text": next_q
                            })
                            
                            audio_bytes = await synthesize_speech(next_q)
                            if audio_bytes:
                                await websocket.send_bytes(audio_bytes)
                            
                            turn_start_time = time.time()
                    except Exception as parse_err:
                        logger.error(f"Mock parser error: {parse_err}")
                elif "bytes" in message:
                    # No speech-to-text backend is configured, so this audio
                    # cannot be transcribed. Previously this branch substituted
                    # a fixed sentence and ran real telemetry over it, handing
                    # the user WPM, filler counts, and a STAR score for words
                    # they never said. Say so instead, and score nothing.
                    if not transcription_unavailable_sent:
                        transcription_unavailable_sent = True
                        await websocket.send_json({
                            "type": "transcription_unavailable",
                            "message": (
                                "Speech-to-text is not configured on this server, so your "
                                "spoken answers can't be scored. Type your answer to get "
                                "telemetry and a follow-up question."
                            ),
                        })
            return

        # =====================================================================
        # Active Deepgram connection
        # =====================================================================
        dg_url = "wss://api.deepgram.com/v1/listen?model=nova-2&endpointing=800&smart_format=true"
        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}

        async with websockets.connect(dg_url, extra_headers=headers) as dg_ws:
            async def read_from_dg():
                nonlocal current_question, turn_start_time, accumulated_transcript
                try:
                    async for msg in dg_ws:
                        res = json.loads(msg)
                        channel = res.get("channel", {})
                        alternatives = channel.get("alternatives", [{}])
                        transcript = alternatives[0].get("transcript", "")
                        
                        if transcript:
                            is_final = res.get("is_final", False)
                            await websocket.send_json({
                                "type": "transcription",
                                "text": transcript,
                                "is_final": is_final
                            })
                            if is_final:
                                accumulated_transcript.append(transcript)

                        # Check for end of turn/utterance
                        if res.get("speech_final") or res.get("type") == "UtteranceEnd":
                            full_response = " ".join(accumulated_transcript).strip()
                            if not full_response:
                                continue
                            
                            duration = time.time() - turn_start_time
                            telemetry = analyze_speech_telemetry(full_response, duration)
                            
                            # Stream telemetry report
                            await websocket.send_json({
                                "type": "telemetry",
                                "wpm": telemetry["wpm"],
                                "fillers": telemetry["fillers"],
                                "star_compliance": telemetry["star_compliance"]
                            })

                            # Generate next interviewer question
                            prompt = f"The candidate was asked: '{current_question}'. They responded: '{full_response}'. Ask the next interview question for a {target_role}."
                            next_q = await generate_llm_response(prompt, system_msg)
                            current_question = next_q

                            await websocket.send_json({
                                "type": "llm_text",
                                "text": next_q
                            })

                            # Synthesize and stream
                            audio = await synthesize_speech(next_q)
                            if audio:
                                await websocket.send_bytes(audio)

                            # Reset turn vars
                            accumulated_transcript = []
                            turn_start_time = time.time()

                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error reading from Deepgram: {e}")

            # Run Deepgram reader in background
            dg_reader = asyncio.create_task(read_from_dg())

            try:
                while True:
                    # Receive data from client
                    message = await websocket.receive()
                    if "bytes" in message:
                        # Forward audio chunks directly to Deepgram
                        await dg_ws.send(message["bytes"])
                    elif "text" in message:
                        text_data = message["text"]
                        try:
                            payload = json.loads(text_data)
                            # Handle stop or skip control frames
                            if payload.get("type") == "stop":
                                break
                        except Exception:
                            pass
            finally:
                dg_reader.cancel()
                await dg_reader

    except WebSocketDisconnect:
        logger.info("Voice stream WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}")
