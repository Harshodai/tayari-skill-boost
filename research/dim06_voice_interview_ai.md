# Dimension 6: Real-Time Voice Interview AI

## Executive Summary

Building a real-time voice AI mock interview system is the most impactful next feature for Tayari's Interview Preparation module. In 2026, competitors like InterviewLab (free), Himalayas Plus ($9/month), and Revarta (voice-first behavioral coaching) have proven that voice-based practice is no longer a novelty — it's becoming the standard expectation for serious interview prep tools.

Tayari's unique advantage is **local-first architecture**: by combining **Whisper** (local speech-to-text) or **faster-whisper** with **Ollama** (local LLM) and **Piper** (local TTS), we can offer voice mock interviews with **zero cloud API costs** and **complete privacy** — something no competitor can match. For users who prefer cloud quality, we can offer Deepgram Nova-3 (6.84% WER, <300ms) and OpenAI TTS as premium options.

The recommended architecture is **WebSocket-based** (not WebRTC) for stability, with a **modular STT → LLM → TTS pipeline** that achieves ~1.1-1.3 seconds end-to-end latency — acceptable for interview practice, though not ideal conversational AI. The system will support **adaptive questioning** based on resume knowledge graph, **STAR-method scoring**, and **longitudinal progress tracking**.

**Implementation estimate:** 8-12 weeks for full voice capability (phased: text-to-speech hybrid → full WebSocket voice → advanced analytics).

---

## Technology Landscape

### Speech-to-Text (STT) Options

| Model | Streaming WER | Batch WER | Languages | Latency | Best For | Cost |
|-------|--------------|-----------|-----------|---------|----------|------|
| **Deepgram Nova-3** | 6.84% | 5.26% | 40+ | <300ms | Real-time voice agents | $0.0043/min |
| **AssemblyAI Universal-2** | ~6% | <6% | 100+ | ~270ms | Enterprise feature depth | ~$0.0037/min |
| **OpenAI gpt-4o-transcribe** | ~5% | <5% | 50+ | Low | High-accuracy apps | $0.006/min |
| **Whisper Large V3 Turbo** | ~10.6% | ~8% | 99 | Moderate | Self-hosted / fine-tuning | $0 (GPU cost) |
| **faster-whisper** | ~10% | ~8% | 99 | Moderate | Local deployment, optimized | $0 (GPU cost) |
| **ElevenLabs Scribe v2** | ~3.3% | ~3.3% | 99 | Sub-150ms | English-focused accuracy | ~$0.005/min |
| **Canary-Qwen-2.5B (open)** | N/A | Leaderboard | EN+multilingual | Moderate | Max accuracy, batch | $0 (GPU cost) |

**Recommendation for Tayari:**
- **Primary:** `faster-whisper` (local) for privacy-first users — runs on CPU with acceptable latency, or GPU for real-time performance
- **Premium fallback:** Deepgram Nova-3 WebSocket API for users who want lowest latency and highest accuracy
- **Why not Whisper.cpp?** Good for edge devices, but faster-whisper is better optimized for server deployment with batching

### Text-to-Speech (TTS) Options

| Provider | Latency | Voice Quality | Languages | Local? | Cost |
|----------|---------|--------------|-----------|--------|------|
| **OpenAI TTS** | Low | Good, natural | ~20 | No | $0.015/1K chars |
| **Piper** | Very low | Decent, lightweight | ~30 | **Yes** | $0 |
| **Coqui TTS** | Low | Good, trainable | ~10 | **Yes** | $0 |
| **ElevenLabs TTS** | Low | Excellent | 30+ | No | ~$0.03/1K chars |
| **Cartesia Sonic** | ~40ms TTFA | Very good | 15+ | No | Tiered |

**Recommendation for Tayari:**
- **Primary:** Piper (local, lightweight, 30+ languages, runs on CPU)
- **Premium fallback:** OpenAI TTS for cloud users
- **Why not Coqui TTS?** Better voice quality but heavier models; Piper is simpler for MVP

### Voice Activity Detection (VAD)

| Solution | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Silero VAD** | Lightweight, accurate, easy to integrate | Tuning required for different accents | **Primary choice** |
| **LiveKit VAD** | Integrated with WebRTC stack | Memory issues at scale, complex | Avoid for now |
| **WebRTC native VAD** | Built-in, no extra dependency | Less accurate, harder to control | Fallback |
| **Deepgram integrated EOT** | End-of-turn detection built-in | Cloud-only, adds latency | Use with Deepgram STT only |

**Key insight from 47Billion's research:** VAD is the most unexpectedly challenging component. Early triggers interrupt users; late triggers cause awkward silences. A tuned Silero implementation with adaptive thresholds based on speaking pace is the pragmatic choice.

### Transport Layer: WebSocket vs WebRTC

| Aspect | WebSocket | WebRTC |
|--------|-----------|--------|
| Latency | Acceptable (~100ms overhead) | Lower (direct peer-to-peer) |
| Complexity | Low (standard HTTP upgrade) | High (TURN servers, NAT traversal) |
| Debugging | Easy (standard network tools) | Hard (complex protocol stack) |
| Deployment | Simple (same server as REST API) | Complex (requires STUN/TURN infrastructure) |
| Echo cancellation | Must implement in browser | Built-in |
| Memory stability | Stable | Memory issues reported at scale |
| Mobile support | Good | Good but complex |

**Recommendation:** **WebSocket is the right default** for Tayari's product team. It's easier to deploy, debug, and monitor. WebRTC makes sense only if we need telephony-grade latency or barge-in handling — which is Phase 3, not Phase 1.

### Real-Time Voice AI Pipeline Comparison

| Approach | Latency | Cost/15min | Transcript Access | Audio Access | Best For |
|----------|---------|------------|-------------------|--------------|----------|
| Integrated S2S APIs (OpenAI Realtime) | 0.78-2.98s | $0.60-$2.00 | Limited | No | Quick MVP, no analytics |
| **Modular STT→LLM→TTS** | **~1.1-1.3s** | **~$0.30** (cloud) / **$0** (local) | **Full** | **Full** | **Tayari's use case** |

The modular approach is essential for Tayari because we need:
- Full transcripts for STAR scoring and feedback
- Raw audio for voice analysis (filler words, pacing, confidence)
- Conversation history for longitudinal analytics
- Local deployment option for privacy

---

## Technical Architecture

### Full Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React)                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ MediaRecorder│───→│ Audio chunks │───→│ WebSocket Client     │   │
│  │ (getUserMedia)│   │ (Opus/PCM)   │    │ (binary audio stream)│   │
│  └─────────────┘    └──────────────┘    └──────────┬───────────┘   │
│                                                    │                │
│  ┌─────────────────────────────────────────────────┘                │
│  │  WebSocket Server (FastAPI)                                       │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  │ VAD (Silero)  │───→│ STT (Whisper)│───→│ LLM (Ollama) │      │
│  │  │ (detect EOT)  │    │ (transcribe) │    │ (generate    │      │
│  │  └──────────────┘    └──────────────┘    │  response)   │      │
│  │                                          └──────┬───────┘      │
│  │                                                 │              │
│  │  ┌──────────────┐    ┌──────────────┐          │              │
│  │  │ TTS (Piper)   │←───│ Text chunks  │←─────────┘              │
│  │  │ (synthesize) │    │ (streaming)  │                           │
│  │  └──────┬───────┘    └──────────────┘                           │
│  └─────────┼──────────────────────────────────────────────────────┘
│            │
│  ┌─────────▼──────────┐
│  │ Audio playback     │
│  │ (Web Audio API)    │
│  └────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Frontend (React + Web Audio API)

```typescript
// src/hooks/useVoiceInterview.ts
import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceInterviewState {
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  transcript: string;
  aiTranscript: string;
  isMuted: boolean;
  error: string | null;
}

export function useVoiceInterview(interviewId: number) {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [state, setState] = useState<VoiceInterviewState>({
    status: 'idle',
    transcript: '',
    aiTranscript: '',
    isMuted: false,
    error: null,
  });

  const startInterview = useCallback(async () => {
    try {
      setState(s => ({ ...s, status: 'connecting' }));
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Whisper prefers 16kHz
        } 
      });

      // Connect WebSocket
      const ws = new WebSocket(
        `wss://api.tayari.app/ws/interview/${interviewId}?token=${getAuthToken()}`
      );
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        // Start recording with Opus codec if available, else PCM
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : { mimeType: 'audio/webm' };
        
        const recorder = new MediaRecorder(stream, options);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
        recorder.start(200); // 200ms chunks for low latency
        mediaRecorderRef.current = recorder;
        setState(s => ({ ...s, status: 'listening' }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
      };

      ws.onerror = (error) => {
        setState(s => ({ ...s, status: 'error', error: 'Connection failed' }));
      };

    } catch (err) {
      setState(s => ({ ...s, status: 'error', error: (err as Error).message }));
    }
  }, [interviewId]);

  const handleMessage = (msg: any) => {
    switch (msg.type) {
      case 'transcript_partial':
        setState(s => ({ ...s, transcript: msg.text }));
        break;
      case 'transcript_final':
        setState(s => ({ ...s, transcript: msg.text, status: 'thinking' }));
        break;
      case 'ai_response_chunk':
        setState(s => ({ ...s, aiTranscript: s.aiTranscript + msg.text, status: 'speaking' }));
        break;
      case 'ai_audio_chunk':
        playAudioChunk(msg.audio); // base64 encoded audio
        break;
      case 'interview_complete':
        setState(s => ({ ...s, status: 'idle' }));
        break;
      case 'error':
        setState(s => ({ ...s, status: 'error', error: msg.message }));
        break;
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 22050 });
    }
    const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
    const audioContext = audioContextRef.current;
    
    audioContext.decodeAudioData(audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength))
      .then(buffer => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      });
  };

  return { state, startInterview, stopInterview: () => { /* cleanup */ } };
}
```

#### 2. Backend WebSocket Handler (FastAPI)

```python
# backend/python/app/api/voice_interview.py
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.services.voice_interview import VoiceInterviewService
import asyncio
import json
import base64
from typing import Optional

class VoiceInterviewWebSocket:
    def __init__(self):
        self.active_interviews: dict[int, VoiceInterviewService] = {}
    
    async def handle_interview(
        self, 
        websocket: WebSocket, 
        interview_id: int,
        user_id: int,
        resume_id: Optional[int] = None,
        job_id: Optional[int] = None,
    ):
        await websocket.accept()
        
        # Initialize interview service with context
        service = VoiceInterviewService(
            interview_id=interview_id,
            user_id=user_id,
            resume_id=resume_id,
            job_id=job_id,
            stt_engine="faster-whisper",  # or "deepgram"
            tts_engine="piper",           # or "openai"
            llm_engine="ollama",          # or "openai"
        )
        self.active_interviews[interview_id] = service
        
        try:
            # Send welcome message
            welcome_audio = await service.generate_welcome()
            await self.send_audio_message(websocket, welcome_audio, 
                "Welcome to your Tayari mock interview. I'm your AI interviewer today. Let's begin with your background. Tell me about yourself and your experience.")
            
            while True:
                # Receive audio chunk
                message = await websocket.receive()
                
                if message["type"] == "websocket.receive":
                    if "bytes" in message:
                        audio_chunk = message["bytes"]
                        
                        # Process through pipeline
                        result = await service.process_audio_chunk(audio_chunk)
                        
                        if result.has_transcript_update:
                            await websocket.send_json({
                                "type": "transcript_partial",
                                "text": result.partial_transcript
                            })
                        
                        if result.is_end_of_turn:
                            # User finished speaking
                            await websocket.send_json({
                                "type": "transcript_final",
                                "text": result.final_transcript
                            })
                            
                            # Generate AI response (streaming)
                            await self.stream_ai_response(websocket, service, result.final_transcript)
                            
        except WebSocketDisconnect:
            await service.end_interview()
            del self.active_interviews[interview_id]
    
    async def stream_ai_response(
        self, 
        websocket: WebSocket, 
        service: VoiceInterviewService, 
        user_transcript: str
    ):
        """Stream AI response: text chunks + synthesized audio"""
        
        # Generate response text (streaming from LLM)
        full_response = ""
        async for text_chunk in service.generate_response(user_transcript):
            full_response += text_chunk
            await websocket.send_json({
                "type": "ai_response_chunk",
                "text": text_chunk
            })
        
        # Synthesize audio for the full response (or sentence-by-sentence)
        # For Piper, we synthesize in sentences for lower latency
        sentences = service.split_into_sentences(full_response)
        for sentence in sentences:
            audio_data = await service.synthesize_speech(sentence)
            await self.send_audio_message(websocket, audio_data, sentence)
    
    async def send_audio_message(self, websocket: WebSocket, audio_data: bytes, text: str):
        """Send audio as base64-encoded message"""
        await websocket.send_json({
            "type": "ai_audio_chunk",
            "audio": base64.b64encode(audio_data).decode('utf-8'),
            "text": text
        })

# Router
from fastapi import APIRouter
router = APIRouter()

voice_ws = VoiceInterviewWebSocket()

@router.websocket("/ws/interview/{interview_id}")
async def interview_websocket(websocket: WebSocket, interview_id: int):
    # Extract auth from query param or header
    token = websocket.query_params.get("token")
    user = await verify_websocket_token(token)
    
    await voice_ws.handle_interview(
        websocket=websocket,
        interview_id=interview_id,
        user_id=user.id,
        resume_id=websocket.query_params.get("resume_id"),
        job_id=websocket.query_params.get("job_id"),
    )
```

#### 3. Voice Interview Service (Core Logic)

```python
# backend/python/app/services/voice_interview.py
import numpy as np
import torch
from faster_whisper import WhisperModel
from piper import PiperVoice
import ollama
from dataclasses import dataclass
from typing import AsyncGenerator, Optional
import asyncio
from collections import deque

@dataclass
class AudioProcessingResult:
    partial_transcript: str = ""
    final_transcript: str = ""
    has_transcript_update: bool = False
    is_end_of_turn: bool = False
    confidence: float = 0.0

class VoiceInterviewService:
    def __init__(
        self,
        interview_id: int,
        user_id: int,
        resume_id: Optional[int] = None,
        job_id: Optional[int] = None,
        stt_engine: str = "faster-whisper",
        tts_engine: str = "piper",
        llm_engine: str = "ollama",
    ):
        self.interview_id = interview_id
        self.user_id = user_id
        self.resume_id = resume_id
        self.job_id = job_id
        
        # Initialize STT
        if stt_engine == "faster-whisper":
            self.stt = WhisperModel("large-v3", device="cuda" if torch.cuda.is_available() else "cpu", compute_type="int8")
        elif stt_engine == "deepgram":
            self.stt = DeepgramSTT(api_key=DEEPGRAM_API_KEY)
        
        # Initialize TTS
        if tts_engine == "piper":
            self.tts = PiperVoice.load("en_US-lessac-medium.onnx")
        elif tts_engine == "openai":
            self.tts = OpenAITTS(api_key=OPENAI_API_KEY)
        
        # VAD
        self.vad = SileroVAD(model_path="silero_vad.onnx")
        
        # Conversation state
        self.conversation_history = []
        self.audio_buffer = deque(maxlen=50)  # ~5 seconds of audio
        self.current_question = None
        self.questions_asked = []
        self.responses = []
        
        # Load interview context
        self._load_context()
    
    def _load_context(self):
        """Load resume knowledge graph and job description for context-aware questions"""
        if self.resume_id:
            self.resume_context = get_resume_knowledge_graph(self.resume_id)
        if self.job_id:
            self.job_context = get_job_description(self.job_id)
        
        # Generate initial question set
        self.question_queue = self._generate_questions()
    
    def _generate_questions(self) -> list[dict]:
        """Generate contextual questions from resume + job description"""
        # Use LLM to generate personalized questions
        prompt = f"""You are an expert interviewer. Generate 10 interview questions for a candidate based on:
        
Resume Profile: {self.resume_context.get('summary', 'Not provided')}
Key Skills: {', '.join(self.resume_context.get('skills', [])[:10])}
Projects: {self.resume_context.get('projects', 'Not provided')}

Job Description: {self.job_context.get('description', 'Not provided')}
Required Skills: {', '.join(self.job_context.get('required_skills', [])[:10])}

Generate a mix of:
- 3 behavioral questions (STAR method) based on resume experience
- 3 technical questions based on required skills
- 2 situational questions based on job responsibilities
- 2 questions about specific projects from resume

Format as JSON array with fields: id, type, text, expected_duration_seconds"""

        response = ollama.generate(
            model="llama3.2",
            prompt=prompt,
            format="json",
            options={"temperature": 0.7, "num_predict": 2000}
        )
        return json.loads(response['response'])
    
    async def process_audio_chunk(self, audio_chunk: bytes) -> AudioProcessingResult:
        """Process incoming audio chunk through VAD → STT pipeline"""
        
        # Convert audio to numpy array (assume 16kHz, 16-bit PCM from WebM/Opus)
        audio_np = self._decode_audio_chunk(audio_chunk)
        
        # Add to buffer
        self.audio_buffer.append(audio_np)
        
        # VAD: Detect speech vs. silence
        speech_prob = self.vad.detect_speech(audio_np)
        
        if speech_prob < 0.3:
            # Silence detected - check if it's end of turn
            if self._is_end_of_turn():
                # Transcribe accumulated audio
                full_audio = np.concatenate(list(self.audio_buffer))
                segments, _ = self.stt.transcribe(full_audio, language="en", beam_size=5)
                transcript = " ".join([seg.text for seg in segments])
                
                return AudioProcessingResult(
                    final_transcript=transcript,
                    is_end_of_turn=True,
                    confidence=sum(seg.confidence for seg in segments) / len(segments) if segments else 0
                )
            return AudioProcessingResult()
        
        # Speech detected - do partial transcription for UI feedback
        if len(self.audio_buffer) % 10 == 0:  # Every ~1 second
            recent_audio = np.concatenate(list(self.audio_buffer)[-20:])  # Last ~2 seconds
            segments, _ = self.stt.transcribe(recent_audio, language="en", beam_size=1, best_of=1)
            partial = " ".join([seg.text for seg in segments])
            
            return AudioProcessingResult(
                partial_transcript=partial,
                has_transcript_update=True
            )
        
        return AudioProcessingResult()
    
    def _is_end_of_turn(self) -> bool:
        """Detect if user has finished speaking (silence duration > threshold)"""
        # Check last N audio chunks for silence
        if len(self.audio_buffer) < 10:
            return False
        
        recent_silence = [
            self.vad.detect_speech(chunk) < 0.3 
            for chunk in list(self.audio_buffer)[-15:]
        ]
        
        # End of turn if >80% of recent chunks are silence AND we had some speech before
        return sum(recent_silence) / len(recent_silence) > 0.8 and self._had_speech_in_buffer()
    
    def _had_speech_in_buffer(self) -> bool:
        return any(self.vad.detect_speech(chunk) > 0.5 for chunk in self.audio_buffer)
    
    async def generate_response(self, user_transcript: str) -> AsyncGenerator[str, None]:
        """Generate AI interviewer response using LLM"""
        
        # Get next question from queue or generate follow-up
        if self.current_question and not self._is_answer_sufficient(user_transcript):
            # Generate probing follow-up for vague answer
            question = self._generate_follow_up(user_transcript)
        else:
            question = self.question_queue.pop(0) if self.question_queue else None
            if not question:
                # Interview complete
                yield "Thank you for your time today. That concludes our interview. You'll receive detailed feedback shortly."
                return
        
        self.current_question = question
        self.responses.append({
            "question": question,
            "answer": user_transcript,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Stream response from LLM
        prompt = self._build_interviewer_prompt(question, user_transcript)
        
        stream = ollama.generate(
            model="llama3.2",
            prompt=prompt,
            stream=True,
            options={"temperature": 0.7, "num_predict": 500}
        )
        
        for chunk in stream:
            yield chunk['response']
    
    def _is_answer_sufficient(self, answer: str) -> bool:
        """Check if answer is detailed enough or needs follow-up probing"""
        # Simple heuristic: length, presence of metrics, STAR components
        word_count = len(answer.split())
        has_metrics = any(char.isdigit() for char in answer)
        has_star = all(word in answer.lower() for word in ['i', 'we', 'result', 'outcome']) or word_count > 50
        
        return word_count > 30 and (has_metrics or has_star)
    
    def _generate_follow_up(self, answer: str) -> str:
        """Generate a probing follow-up question for vague answers"""
        # Use LLM to generate contextual follow-up
        prompt = f"""The candidate gave this vague answer: "{answer}"
        Generate a specific follow-up question that probes deeper for details, metrics, or specific outcomes.
        Keep it under 2 sentences."""
        
        response = ollama.generate(model="llama3.2", prompt=prompt, options={"num_predict": 100})
        return response['response'].strip()
    
    async def synthesize_speech(self, text: str) -> bytes:
        """Synthesize speech using TTS engine"""
        if isinstance(self.tts, PiperVoice):
            # Piper returns numpy audio array
            audio = self.tts.synthesize(text)
            # Convert to WAV bytes
            return self._numpy_to_wav_bytes(audio, sample_rate=22050)
        else:
            return await self.tts.synthesize(text)
    
    async def end_interview(self):
        """Save interview session and generate feedback report"""
        # Calculate scores
        scores = self._calculate_scores()
        
        # Save to database
        save_interview_session(
            interview_id=self.interview_id,
            user_id=self.user_id,
            questions=self.responses,
            scores=scores,
            duration_seconds=self._calculate_duration(),
        )
        
        # Generate detailed feedback (async, sent to user later)
        feedback = await self._generate_feedback_report()
        await send_feedback_notification(self.user_id, self.interview_id, feedback)
    
    def _calculate_scores(self) -> dict:
        """Calculate interview performance scores"""
        # Analyze all responses for various metrics
        all_answers = " ".join([r["answer"] for r in self.responses])
        
        return {
            "star_compliance": self._score_star_method(all_answers),
            "filler_word_ratio": self._count_filler_words(all_answers),
            "avg_response_length": sum(len(r["answer"].split()) for r in self.responses) / len(self.responses),
            "confidence_estimate": self._estimate_confidence(),
            "technical_depth": self._score_technical_depth(all_answers),
            "clarity": self._score_clarity(all_answers),
        }
    
    def _score_star_method(self, text: str) -> float:
        """Score how well answers follow STAR method (0-100)"""
        text_lower = text.lower()
        
        # Check for STAR components
        situation = any(word in text_lower for word in ['when', 'during', 'at', 'in my role', 'project', 'team'])
        task = any(word in text_lower for word in ['responsible', 'task', 'goal', 'objective', 'needed to', 'had to'])
        action = any(word in text_lower for word in ['i', 'we', 'implemented', 'developed', 'created', 'led', 'managed'])
        result = any(word in text_lower for word in ['result', 'outcome', 'achieved', 'increased', 'decreased', 'improved', 'saved', 'generated', '%', 'percent'])
        
        score = 0
        if situation: score += 25
        if task: score += 25
        if action: score += 25
        if result: score += 25
        
        return score
    
    def _count_filler_words(self, text: str) -> float:
        """Count filler words per 100 words"""
        fillers = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically', 'literally', 'actually']
        words = text.lower().split()
        filler_count = sum(words.count(f) for f in fillers)
        return (filler_count / len(words) * 100) if words else 0
    
    def _estimate_confidence(self) -> float:
        """Estimate confidence from response patterns"""
        # Simple heuristic: longer answers with quantifiable results = more confident
        avg_length = sum(len(r["answer"].split()) for r in self.responses) / len(self.responses)
        has_metrics = any(any(c.isdigit() for c in r["answer"]) for r in self.responses)
        
        score = min(avg_length / 3, 50)  # Up to 50 points for length
        if has_metrics: score += 30
        if len(self.responses) >= 5: score += 20
        
        return min(score, 100)
    
    def _score_technical_depth(self, text: str) -> float:
        """Score technical depth based on jargon, specificity, and complexity"""
        # This is a simplified heuristic; production would use LLM scoring
        technical_indicators = ['architecture', 'scalability', 'performance', 'optimization', 
                               'debugging', 'testing', 'deployment', 'integration', 'api', 'database']
        text_lower = text.lower()
        matches = sum(1 for indicator in technical_indicators if indicator in text_lower)
        return min(matches * 10, 100)
    
    def _score_clarity(self, text: str) -> float:
        """Score clarity based on sentence structure, grammar, and coherence"""
        # Simplified: average sentence length, presence of run-on sentences
        sentences = text.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
        
        # Ideal: 15-25 words per sentence
        if 15 <= avg_sentence_length <= 25:
            return 90
        elif avg_sentence_length < 10:
            return 60  # Too choppy
        elif avg_sentence_length > 40:
            return 50  # Too complex
        else:
            return 75
```

#### 4. Database Schema Additions

```sql
-- Interview sessions table
CREATE TABLE interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER REFERENCES resumes(id),
    job_id INTEGER REFERENCES saved_jobs(id),
    interview_type VARCHAR(50) NOT NULL DEFAULT 'behavioral', -- behavioral, technical, mixed
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, abandoned
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    total_questions INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Interview responses (Q&A pairs)
CREATE TABLE interview_responses (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_id INTEGER,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50), -- behavioral, technical, situational, project
    answer_text TEXT,
    audio_url TEXT, -- URL to stored audio file (optional, for local recording)
    transcript TEXT,
    response_duration_seconds INTEGER,
    word_count INTEGER,
    filler_word_count INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Interview scores (per session, per dimension)
CREATE TABLE interview_scores (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    dimension VARCHAR(50) NOT NULL, -- star_compliance, clarity, confidence, technical_depth, communication
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    weight FLOAT NOT NULL DEFAULT 1.0,
    details JSONB, -- detailed breakdown
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Interview feedback reports
CREATE TABLE interview_feedback (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (score >= 0 AND score <= 100),
    summary TEXT,
    strengths JSONB, -- array of strings
    improvements JSONB, -- array of strings
    star_analysis JSONB, -- detailed STAR analysis
    detailed_feedback TEXT, -- LLM-generated full feedback
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX idx_interview_responses_session_id ON interview_responses(session_id);
CREATE INDEX idx_interview_scores_session_id ON interview_scores(session_id);
```

---

## Adaptive Interview Engine Design

### Mode-Based Interview Types

Following 47Billion's finding that "generic questions felt generic," the system supports multiple interview modes:

| Mode | Description | Question Source | Best For |
|------|-------------|----------------|----------|
| **Behavioral** | STAR-method questions about past experience | Resume knowledge graph + job description | General screening, cultural fit |
| **Technical** | Role-specific technical questions | Job required skills + resume tech stack | Engineering, data science, IT roles |
| **Project-Based** | Deep-dive into specific resume projects | Resume projects section | Portfolio review, senior roles |
| **Situational** | Hypothetical scenario questions | Job responsibilities | Leadership, management roles |
| **Mixed** | Rotating combination of above | All sources | Comprehensive practice |

### Question Generation Pipeline

```
Resume KG + Job Description
        ↓
    [LLM Prompt]
    "Generate 10 questions based on:
     - Candidate's top 5 skills
     - 3 key projects with metrics
     - Job's required skills and responsibilities
     - Interview mode: {behavioral|technical|mixed}"
        ↓
    JSON Array of Questions
        ↓
    Store in interview_sessions.question_queue
```

### Adaptive Follow-Up Logic

```python
def determine_next_action(user_answer: str, current_question: dict) -> Action:
    """Determine whether to accept answer, probe deeper, or move on"""
    
    # Analyze answer quality
    analysis = {
        'word_count': len(user_answer.split()),
        'has_metrics': any(c.isdigit() for c in user_answer),
        'has_star': check_star_components(user_answer),
        'is_vague': is_vague_answer(user_answer),
        'confidence_signals': detect_confidence(user_answer),
    }
    
    if analysis['word_count'] < 20:
        return Action.PROBE_DEEPER("Could you provide more detail? Your answer was quite brief.")
    
    if not analysis['has_metrics'] and current_question['type'] == 'behavioral':
        return Action.PROBE_DEEPER("Can you share specific numbers or outcomes? For example, how much did you improve the metric by?")
    
    if not analysis['has_star']['result']:
        return Action.PROBE_DEEPER("What was the outcome or result of that action?")
    
    if analysis['is_vague']:
        return Action.PROBE_DEEPER("Could you give a specific example rather than speaking in general terms?")
    
    # Good answer, move to next question
    return Action.NEXT_QUESTION()
```

### Difficulty Progression

The interview starts with easier questions and increases difficulty based on performance:

```python
class DifficultyProgression:
    def __init__(self):
        self.current_difficulty = 1  # 1-5 scale
        self.consecutive_good_answers = 0
        self.consecutive_poor_answers = 0
    
    def adjust_difficulty(self, last_answer_score: float):
        if last_answer_score > 80:
            self.consecutive_good_answers += 1
            self.consecutive_poor_answers = 0
            if self.consecutive_good_answers >= 2 and self.current_difficulty < 5:
                self.current_difficulty += 1
        elif last_answer_score < 50:
            self.consecutive_poor_answers += 1
            self.consecutive_good_answers = 0
            if self.consecutive_poor_answers >= 2 and self.current_difficulty > 1:
                self.current_difficulty -= 1
        
        return self.current_difficulty
```

---

## Voice Analysis & Scoring Pipeline

### Real-Time Metrics (During Interview)

| Metric | Detection Method | Feedback Timing |
|--------|-----------------|-----------------|
| **Filler Words** | Regex matching on transcript | After each answer |
| **Pacing (WPM)** | Word count / duration | After each answer |
| **Pause Duration** | VAD silence gaps | After each answer |
| **Response Length** | Word count | After each answer |

### Post-Interview Analysis (Deep Scoring)

```python
class PostInterviewAnalyzer:
    def analyze_session(self, session_id: int) -> InterviewFeedback:
        responses = get_all_responses(session_id)
        
        return InterviewFeedback(
            overall_score=self._calculate_overall(responses),
            star_compliance=self._analyze_star_method(responses),
            clarity_score=self._analyze_clarity(responses),
            confidence_score=self._analyze_confidence(responses),
            technical_depth=self._analyze_technical_depth(responses),
            communication=self._analyze_communication(responses),
            filler_word_analysis=self._analyze_filler_words(responses),
            pacing_analysis=self._analyze_pacing(responses),
            improvement_areas=self._generate_improvements(responses),
            strengths=self._generate_strengths(responses),
        )
    
    def _analyze_star_method(self, responses: list) -> STARAnalysis:
        """Detailed STAR analysis across all behavioral answers"""
        results = []
        for response in responses:
            if response['question_type'] != 'behavioral':
                continue
                
            text = response['answer'].lower()
            result = {
                'situation': self._extract_situation(text),
                'task': self._extract_task(text),
                'action': self._extract_action(text),
                'result': self._extract_result(text),
                'score': self._score_star_completeness(text),
            }
            results.append(result)
        
        return STARAnalysis(
            average_score=sum(r['score'] for r in results) / len(results),
            weakest_component=self._find_weakest_component(results),
            per_answer_breakdown=results,
            improvement_tip=self._generate_star_tip(results),
        )
    
    def _analyze_filler_words(self, responses: list) -> FillerAnalysis:
        """Analyze filler word usage across all responses"""
        fillers = {
            'um': 0, 'uh': 0, 'like': 0, 'you know': 0,
            'sort of': 0, 'kind of': 0, 'basically': 0,
            'literally': 0, 'actually': 0, 'so': 0,
        }
        
        total_words = 0
        for response in responses:
            words = response['answer'].lower().split()
            total_words += len(words)
            for filler in fillers:
                fillers[filler] += words.count(filler)
        
        total_fillers = sum(fillers.values())
        filler_rate = (total_fillers / total_words * 100) if total_words else 0
        
        return FillerAnalysis(
            total_fillers=total_fillers,
            filler_rate_per_100_words=filler_rate,
            top_offender=max(fillers, key=fillers.get),
            severity='high' if filler_rate > 5 else 'medium' if filler_rate > 2 else 'low',
            benchmark='Top performers use <2 fillers per 100 words',
        )
    
    def _analyze_pacing(self, responses: list) -> PacingAnalysis:
        """Analyze speaking pace across responses"""
        wpm_scores = []
        for response in responses:
            if response['duration_seconds'] and response['word_count']:
                wpm = (response['word_count'] / response['duration_seconds']) * 60
                wpm_scores.append(wpm)
        
        avg_wpm = sum(wpm_scores) / len(wpm_scores) if wpm_scores else 0
        
        return PacingAnalysis(
            average_wpm=avg_wpm,
            ideal_range='130-160 WPM',
            assessment='too_slow' if avg_wpm < 120 else 'too_fast' if avg_wpm > 180 else 'good',
            recommendation=self._generate_pacing_recommendation(avg_wpm),
        )
```

### Feedback Report Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TAYARI INTERVIEW FEEDBACK REPORT                          │
│  Session: #1234 | Date: 2026-01-15 | Type: Behavioral      │
├─────────────────────────────────────────────────────────────┤
│  OVERALL SCORE: 74/100  [████████░░░░]                     │
│  Duration: 18 minutes | Questions: 8 | Follow-ups: 3         │
├─────────────────────────────────────────────────────────────┤
│  SCORE BREAKDOWN                                             │
│  ┌─────────────────┐                                       │
│  │ STAR Method    68│ ▓▓▓▓▓▓▓▓░░                            │
│  │ Clarity        82│ ▓▓▓▓▓▓▓▓▓▓                            │
│  │ Confidence     71│ ▓▓▓▓▓▓▓▓░░                            │
│  │ Technical Depth 75│ ▓▓▓▓▓▓▓▓▓░                            │
│  │ Communication  76│ ▓▓▓▓▓▓▓▓▓░                            │
│  │ Filler Words   85│ ▓▓▓▓▓▓▓▓▓▓                            │
│  │ Pacing         70│ ▓▓▓▓▓▓▓▓░░                            │
│  └─────────────────┘                                       │
├─────────────────────────────────────────────────────────────┤
│  ⭐ STRENGTHS                                                │
│  • Strong technical explanations with specific examples      │
│  • Good use of "I" statements showing ownership            │
│  • Low filler word usage (1.8 per 100 words)                 │
│  • Clear structure in most answers                         │
│                                                              │
│  🎯 TOP 3 IMPROVEMENTS                                       │
│  1. ADD RESULTS: 3/8 answers lacked specific outcomes      │
│     "You described actions well but didn't quantify results.│
│      Try adding: 'This reduced load time by 40%'"          │
│  2. SHORTEN INTRODUCTIONS: First 3 answers had 30+ words   │
│     of setup before getting to the point                    │
│  3. SLOW DOWN: Average pace was 178 WPM (ideal: 130-160)   │
│     Practice pausing after key points                      │
├─────────────────────────────────────────────────────────────┤
│  📊 PROGRESS OVER TIME                                       │
│  Session 1: 62 → Session 2: 68 → Session 3: 74              │
│  [Improvement: +12% across 3 sessions]                     │
├─────────────────────────────────────────────────────────────┤
│  💡 RECOMMENDED NEXT STEPS                                   │
│  1. Practice STAR method with 5 specific stories from your │
│     resume (AI-generated practice questions available)       │
│  2. Record yourself answering and check for pacing          │
│  3. Focus on quantifying outcomes in every answer         │
│  4. Try the Technical Interview mode for your target role  │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration with Tayari Stack

### Integration Points

| Tayari Feature | Integration Method | Data Flow |
|---------------|-------------------|-----------|
| **Resume Knowledge Graph** | API call during session init | KG → question generation context |
| **Job Search / Saved Jobs** | job_id parameter in WebSocket URL | Job description → interview context |
| **Interview Board** | POST interview completion webhook | Session results → application.interview_score |
| **Profile** | user_id context | Experience level → difficulty adjustment |
| **Cover Letter** | Shared job context | Same job used for both cover letter + interview prep |
| **Dashboard** | Analytics API | Session history → progress visualization |

### API Endpoints (REST + WebSocket)

```
WebSocket:
  WS /api/v1/ws/interview/{session_id}  → Real-time voice interview

REST:
  POST /api/v1/interview/sessions        → Create new interview session
  GET  /api/v1/interview/sessions         → List user's sessions
  GET  /api/v1/interview/sessions/{id}    → Get session details + responses
  GET  /api/v1/interview/sessions/{id}/feedback  → Get feedback report
  GET  /api/v1/interview/sessions/{id}/scores    → Get detailed scores
  POST /api/v1/interview/sessions/{id}/text     → Text-only practice (fallback)
  GET  /api/v1/interview/questions/generate     → Generate question set (pre-interview)
```

### Fallback Mode (Text-Only)

Not all users will have microphone access or want voice. Provide a text-only fallback:

```typescript
// Text-only interview mode (no WebSocket needed)
// Uses the same question generation + scoring backend
// User types answers, AI responds with text
// Same scoring pipeline applies
```

---

## Implementation Roadmap

### Phase 1: Text-to-Speech Hybrid (Weeks 1-3)
- **Goal:** Build the adaptive interview engine with text-only mode first
- **Tasks:**
  - Database schema for interview_sessions, responses, scores, feedback
  - Question generation API using resume KG + job description
  - Text-only interview UI (question → type answer → get next question)
  - STAR scoring engine (LLM-based analysis)
  - Post-interview feedback report generation
  - Progress tracking across sessions
- **Deliverable:** Text-based mock interview with full scoring and feedback

### Phase 2: Full Voice with WebSocket (Weeks 4-8)
- **Goal:** Add real-time voice capability
- **Tasks:**
  - Set up WebSocket server in FastAPI
  - Integrate faster-whisper (local STT)
  - Integrate Piper (local TTS)
  - Implement Silero VAD for end-of-turn detection
  - Build React voice interview UI (MediaRecorder, WebSocket client, audio playback)
  - Implement voice analysis pipeline (filler words, pacing, WPM)
  - Add audio recording storage (optional, for playback review)
- **Deliverable:** Full voice mock interview with real-time AI interaction

### Phase 3: Advanced Analytics (Weeks 9-12)
- **Goal:** Rich feedback, longitudinal tracking, and mobile support
- **Tasks:**
  - Deep post-interview analysis (confidence estimation, technical depth scoring)
  - Longitudinal progress tracking (compare scores across sessions)
  - Personalized improvement plans based on weak areas
  - Mobile browser support (PWA microphone access)
  - Cloud STT/TTS premium option (Deepgram + OpenAI TTS)
  - Interview session sharing (for mentor/coach review)
- **Deliverable:** Production-ready voice interview system with analytics dashboard

---

## Competitive Analysis

| Competitor | Voice? | Price | Local LLM? | Resume-Aware? | STAR Scoring? | Key Differentiator |
|------------|--------|-------|-----------|--------------|---------------|---------------------|
| **InterviewLab** | ✅ Yes | Free | No | No | No | Zero friction (no signup) |
| **Himalayas Plus** | ✅ Yes | $9/mo | No | ✅ Yes | Partial | Job-specific questions |
| **Revarta** | ✅ Yes | $39/mo | No | ✅ Yes | ✅ Yes | Voice-first, STAR critique |
| **Final Round AI** | ✅ Yes | Paid | No | ✅ Yes | Yes | Live copilot (controversial) |
| **Google Interview Warmup** | ✅ Yes | Free | No | No | No | Google's brand, free |
| **Yoodli** | ✅ Yes | Freemium | No | No | No | Speech coaching focus |
| **Tayari (planned)** | ✅ Yes | Free tier | **✅ Yes** | **✅ Yes** | **✅ Yes** | **Local-first + integrated career loop** |

**Tayari's Differentiation:**
1. **Only platform** that connects voice interview practice to resume knowledge graph and actual job applications
2. **Only platform** with local LLM option (Ollama) for completely private interview practice
3. **Only platform** that tracks interview scores alongside real application outcomes (funnel analytics)
4. **Only platform** with adaptive difficulty based on actual job requirements + resume context

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Latency > 1.5s** | Medium | High | Use Deepgram for cloud users; optimize with sentence-level TTS streaming; preload first audio chunk |
| **Synthetic voice quality** | High | Medium | Use Piper for MVP; offer OpenAI TTS premium; focus on content quality over voice perfection |
| **No barge-in handling** | High | Medium | Document as known limitation; implement in Phase 3 with WebRTC if needed |
| **GPU required for Whisper** | Medium | High | Default to CPU with `faster-whisper` int8 quantization; offer cloud Deepgram as fallback |
| **iOS Safari audio issues** | Medium | High | Thorough testing on iOS; implement audio workarounds for Safari WebKit bugs |
| **Microphone permission denial** | Low | Medium | Provide text-only fallback mode; clear UX for permission request |
| **Privacy concerns with audio** | Medium | Medium | Local processing option; clear data retention policy; no audio storage unless opted-in |
| **Accents not recognized well** | Medium | High | Use Whisper (good multilingual); allow manual transcript correction; add accent calibration |

---

## Recommended Next Steps

### Immediate (Week 1)
1. **Build text-only interview MVP** — Don't start with voice. Build the adaptive question engine, scoring, and feedback with text first. This validates the core logic without audio complexity.
2. **Design database schema** — Create interview_sessions, responses, scores, feedback tables
3. **Implement question generation API** — Connect to resume knowledge graph

### Short-Term (Weeks 2-4)
4. **Build React interview UI** — Text-based practice interface with real-time feedback
5. **Implement STAR scoring engine** — LLM-based analysis of text answers
6. **Add feedback report generation** — Rich, actionable post-interview feedback

### Medium-Term (Weeks 5-8)
7. **Set up WebSocket infrastructure** — FastAPI WebSocket endpoint, connection management
8. **Integrate faster-whisper + Piper** — Local STT + TTS pipeline
9. **Build voice interview UI** — MediaRecorder, audio streaming, playback
10. **Implement VAD (Silero)** — End-of-turn detection

### Long-Term (Weeks 9-12)
11. **Add cloud premium tier** — Deepgram STT + OpenAI TTS for higher quality
12. **Longitudinal analytics** — Track progress across multiple sessions
13. **Mobile PWA support** — Ensure microphone access works on mobile browsers
14. **Integration with Interview Board** — Auto-log interview scores with application records

---

## Verified Resources

- **faster-whisper**: https://github.com/SYSTRAN/faster-whisper (6.2K stars) — Optimized Whisper for faster inference
- **Piper**: https://github.com/rhasspy/piper (5.8K stars) — Fast, local neural TTS
- **Silero VAD**: https://github.com/snakers4/silero-vad (4.2K stars) — Lightweight voice activity detection
- **47Billion Voice AI Architecture**: https://47billion.com/blog/building-real-time-voice-ai-for-mock-interviews/ — Real-world implementation experience
- **Coval STT Benchmarks**: https://www.coval.ai/blog/best-speech-to-text-providers-in-2026/ — 2026 STT provider comparison
- **Inworld Speech-to-Speech**: https://inworld.ai/resources/best-speech-to-speech-apis — 2026 S2S API comparison
- **NextLevel STT Models**: https://nextlevel.ai/best-speech-to-text-models/ — 2026 STT model benchmarks
