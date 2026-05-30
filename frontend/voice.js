const Voice = (() => {
  const BACKEND_URL = 'http://localhost:8000';
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let micBtn;
  let statusEl;

  async function initMediaRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      return recorder;
    } catch (err) {
      console.warn('[MoodTrack] Microphone access denied:', err);
      return null;
    }
  }

  function startRecording() {
    isRecording = true;
    micBtn.classList.add('recording');
    statusEl.textContent = 'Recording... click mic to stop';
    statusEl.classList.remove('hidden');

    if (mediaRecorder && mediaRecorder.state === 'inactive') {
      audioChunks = [];
      mediaRecorder.start();
    }
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    statusEl.textContent = 'Transcribing...';

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];

        if (blob.size === 0) {
          statusEl.classList.add('hidden');
          return;
        }

        try {
          const form = new FormData();
          form.append('file', blob, 'recording.webm');
          const res = await fetch(`${BACKEND_URL}/transcribe`, {
            method: 'POST',
            body: form,
          });
          const data = await res.json();
          statusEl.classList.add('hidden');

          if (data.transcript) {
            App.handleVoiceInput(data.transcript, blob);
          } else {
            statusEl.textContent = "Couldn't catch that. Try again.";
            setTimeout(() => statusEl.classList.add('hidden'), 2000);
          }
        } catch (e) {
          statusEl.classList.add('hidden');
          console.error('[MoodTrack] Transcription failed:', e);
          Chat.addMessage('user', '(voice message — transcription failed)', blob);
          App.api.uploadAudio(App.getConversationId(), blob);
        }
      };
      mediaRecorder.stop();
    } else {
      statusEl.classList.add('hidden');
    }
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  async function init() {
    micBtn = document.getElementById('mic-btn');
    statusEl = document.getElementById('voice-status');

    mediaRecorder = await initMediaRecorder();

    if (!mediaRecorder) {
      micBtn.disabled = true;
      micBtn.title = 'Microphone not available';
      return;
    }

    micBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { speak };
})();
