const Chat = (() => {
  let messagesEl;
  let textInput;
  let sendBtn;

  function addMessage(role, text, audioBlob) {
    const bubble = document.createElement('div');
    bubble.className = `message ${role}`;

    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioWrap = document.createElement('div');
      audioWrap.className = 'audio-block';

      const label = document.createElement('span');
      label.className = 'audio-label';
      label.textContent = 'Voice message';

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = audioUrl;

      audioWrap.appendChild(label);
      audioWrap.appendChild(audio);
      bubble.appendChild(audioWrap);
    }

    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    const ts = document.createElement('div');
    ts.className = 'timestamp';
    ts.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(ts);

    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('typing');
    if (el) el.remove();
  }

  function clearMessages() {
    messagesEl.innerHTML = '';
  }

  function init() {
    messagesEl = document.getElementById('messages');
    textInput = document.getElementById('text-input');
    sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (text) {
        App.handleUserInput(text);
        textInput.value = '';
      }
    });

    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { addMessage, showTyping, hideTyping, clearMessages };
})();
