const App = (() => {
  let conversationId = null;
  let messages = [];
  let backendUp = false;

  const BACKEND_URL = 'http://localhost:8000';

  const api = {
    async createConversation() {
      const res = await fetch(`${BACKEND_URL}/conversations`, { method: 'POST' });
      return res.json();
    },

    async listConversations() {
      const res = await fetch(`${BACKEND_URL}/conversations?limit=50`);
      return res.json();
    },

    async getMessages(convId) {
      const res = await fetch(`${BACKEND_URL}/conversations/${convId}/messages`);
      return res.json();
    },

    async getAgentResponse(conversationId, messageHistory) {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: messageHistory,
        }),
      });
      const data = await res.json();
      return data.response;
    },

    async uploadAudio(convId, blob) {
      const form = new FormData();
      form.append('file', blob, `${Date.now()}.webm`);
      try {
        await fetch(`${BACKEND_URL}/conversations/${convId}/audio`, {
          method: 'POST',
          body: form,
        });
      } catch (e) {
        console.log('[MoodTrack] Audio save failed, blob size:', blob.size);
      }
    },

    async endConversation(convId) {
      const res = await fetch(`${BACKEND_URL}/conversations/${convId}/end`, { method: 'POST' });
      return res.json();
    },

    async getSignals(start, end) {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const res = await fetch(`${BACKEND_URL}/signals?${params}`);
      return res.json();
    },

    async getSignalsSummary(period) {
      const res = await fetch(`${BACKEND_URL}/signals/summary?period=${period || 'daily'}`);
      return res.json();
    },
  };

  async function checkBackend() {
    try {
      const res = await fetch(`${BACKEND_URL}/conversations?limit=1`);
      backendUp = res.ok;
    } catch {
      backendUp = false;
    }
    console.log(`[MoodTrack] Backend ${backendUp ? 'connected' : 'offline — using mock mode'}`);
    return backendUp;
  }

  // --- Mock fallbacks ---

  function getMockResponse(history) {
    const lastMsg = history[history.length - 1]?.text?.toLowerCase() || '';
    const count = history.filter(m => m.role === 'user').length;

    if (count === 1) {
      if (lastMsg.includes('good') || lastMsg.includes('great') || lastMsg.includes('fine'))
        return "That's good to hear! What's been going well today?";
      if (lastMsg.includes('tired') || lastMsg.includes('drained') || lastMsg.includes('exhaust'))
        return "That sounds tough. Is it more mental fatigue or physical? And is there something specific wearing you down?";
      if (lastMsg.includes('stress') || lastMsg.includes('anxious') || lastMsg.includes('worried'))
        return "I hear you. When you say stressed, what's the main thing weighing on you right now?";
      return "Tell me more about that. What's been on your mind today?";
    }
    if (count === 2)
      return "Yeah, that makes sense. How did you sleep last night? And have you been eating okay today?";
    if (count === 3)
      return "Got it. It sounds like there's a lot going on. Is there anything that's helped you feel a bit better recently, even something small?";
    if (count >= 4)
      return "Thanks for sharing all of this. Here's what I'm picking up from our conversation — you seem a bit drained, with some stress building up. Does that feel right?";
    return "Mmhmm, go on.";
  }

  function getMockSignals() {
    return {
      signals: {
        mood: 4, energy: 3, stress: 7, anxiety: 5,
        sleep_quality: 6,
        topics: ['work', 'sleep', 'meetings'],
        concerns: ['deadline pressure'],
        summary: 'User appears moderately stressed with low energy, likely from a busy workday and insufficient rest.',
      },
    };
  }

  function getMockDashboardData() {
    const days = 14;
    const signals = [];
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      signals.push(
        { timestamp: dateStr, signal_type: 'mood', value: 4 + Math.round(Math.random() * 4) },
        { timestamp: dateStr, signal_type: 'energy', value: 3 + Math.round(Math.random() * 5) },
        { timestamp: dateStr, signal_type: 'stress', value: 3 + Math.round(Math.random() * 5) },
      );
    }
    return signals;
  }

  // --- Sidebar ---

  async function loadSidebar() {
    const listEl = document.getElementById('convo-list');
    listEl.innerHTML = '';
    try {
      const convos = await api.listConversations();
      convos.forEach(c => {
        const item = document.createElement('button');
        item.className = `convo-item${c.id === conversationId ? ' active' : ''}`;
        item.dataset.id = c.id;

        const date = new Date(c.created_at);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        item.innerHTML = `
          <div class="convo-date">${dateStr} ${timeStr}</div>
          <div class="convo-summary">${c.summary || 'Check-in'}</div>
        `;
        item.addEventListener('click', () => loadConversation(c.id));
        listEl.appendChild(item);
      });
    } catch {
      listEl.innerHTML = '<p style="font-size:0.75rem;color:var(--pico-muted-color)">Backend offline</p>';
    }
  }

  async function loadConversation(convId) {
    conversationId = convId;
    Chat.clearMessages();
    setInputEnabled(true);
    document.getElementById('empty-state')?.remove();

    try {
      const msgs = await api.getMessages(convId);
      messages = msgs.map(m => ({ role: m.role, text: m.text }));
      msgs.forEach(m => Chat.addMessage(m.role, m.text));
    } catch {
      messages = [];
    }

    document.getElementById('end-session-btn').disabled = false;
    highlightSidebarItem(convId);
  }

  function highlightSidebarItem(convId) {
    document.querySelectorAll('.convo-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === convId);
    });
  }

  function setInputEnabled(enabled) {
    document.getElementById('text-input').disabled = !enabled;
    document.getElementById('send-btn').disabled = !enabled;
    document.getElementById('mic-btn').disabled = !enabled;
  }

  // --- App logic ---

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'dashboard') Dashboard.render();
      });
    });
  }

  async function startConversation() {
    Chat.clearMessages();
    document.getElementById('empty-state')?.remove();

    try {
      const conv = await api.createConversation();
      conversationId = conv.id;
    } catch {
      conversationId = `conv_${Date.now()}`;
    }
    messages = [];
    setInputEnabled(true);
    document.getElementById('end-session-btn').disabled = false;

    const greeting = "Hey, how are you doing today? What's on your mind?";
    Chat.addMessage('assistant', greeting);
    messages.push({ role: 'assistant', text: greeting });

    loadSidebar();
  }

  async function handleUserInput(text) {
    if (!text.trim() || !conversationId) return;
    Chat.addMessage('user', text);
    await sendAndRespond(text);
  }

  async function handleVoiceInput(transcript, audioBlob) {
    if (!transcript || !conversationId) return;
    Chat.addMessage('user', transcript, audioBlob);
    if (audioBlob) {
      api.uploadAudio(conversationId, audioBlob);
    }
    await sendAndRespond(transcript);
  }

  async function sendAndRespond(text) {
    messages.push({ role: 'user', text });

    Chat.showTyping();
    try {
      if (!backendUp) await checkBackend();

      if (backendUp) {
        const response = await api.getAgentResponse(conversationId, messages);
        Chat.hideTyping();
        Chat.addMessage('assistant', response);
        messages.push({ role: 'assistant', text: response });
        // Voice.speak(response);
      } else {
        throw new Error('backend offline');
      }
    } catch (e) {
      Chat.hideTyping();
      const fallback = getMockResponse(messages);
      Chat.addMessage('assistant', fallback);
      messages.push({ role: 'assistant', text: fallback });
      console.warn('[MoodTrack] Using mock response:', e.message || e);
    }
  }

  async function endConversation() {
    if (!conversationId) return;
    try {
      const result = await api.endConversation(conversationId);
      const s = result.signals;
      Chat.addMessage('assistant',
        `Check-in complete. Here's what I picked up:\n\n` +
        `Mood: ${s.mood}/10\nEnergy: ${s.energy}/10\nStress: ${s.stress}/10\n` +
        `Topics: ${(s.topics || []).join(', ')}\n\n${s.summary}`
      );
    } catch {
      const result = getMockSignals();
      const s = result.signals;
      Chat.addMessage('assistant',
        `Check-in complete. Here's what I picked up:\n\n` +
        `Mood: ${s.mood}/10\nEnergy: ${s.energy}/10\nStress: ${s.stress}/10\n` +
        `Topics: ${s.topics.join(', ')}\n\n${s.summary}`
      );
    }
    document.getElementById('end-session-btn').disabled = true;
    setInputEnabled(false);
    conversationId = null;
    messages = [];
    loadSidebar();
  }

  async function init() {
    initTabs();
    await checkBackend();
    loadSidebar();
    document.getElementById('new-convo-btn').addEventListener('click', startConversation);
    document.getElementById('end-session-btn').addEventListener('click', endConversation);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { handleUserInput, handleVoiceInput, api, checkBackend, getMockDashboardData, getConversationId: () => conversationId };
})();
