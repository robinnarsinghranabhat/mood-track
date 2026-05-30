const Dashboard = (() => {
  const BACKEND_URL = 'http://localhost:8000';

  const CONVO_COLORS = {
    mood: '#6366f1',
    energy: '#22c55e',
    stress: '#ef4444',
    anxiety: '#f59e0b',
    sleep_quality: '#8b5cf6',
  };

  const VOICE_COLORS = {
    voice_energy: '#06b6d4',
    speaking_rate: '#14b8a6',
    voice_brightness: '#f97316',
    pitch_variability: '#ec4899',
    hnr: '#84cc16',
  };

  const ALL_COLORS = { ...CONVO_COLORS, ...VOICE_COLORS };

  const SIGNAL_LABELS = {
    mood: 'Mood',
    energy: 'Energy',
    stress: 'Stress',
    anxiety: 'Anxiety',
    sleep_quality: 'Sleep',
    voice_energy: 'Voice Energy',
    speaking_rate: 'Speaking Rate',
    voice_brightness: 'Voice Brightness',
    pitch_variability: 'Pitch Variability',
    hnr: 'Voice Clarity (HNR)',
  };

  const CONVO_TYPES = new Set(Object.keys(CONVO_COLORS));
  const VOICE_TYPES = new Set(Object.keys(VOICE_COLORS));
  const SKIP_RAW = new Set(['pitch_mean', 'jitter', 'shimmer']);

  let allSignals = [];
  let conversations = [];

  async function render() {
    try {
      [allSignals, conversations] = await Promise.all([
        App.api.getSignals(),
        App.api.listConversations(),
      ]);
    } catch {
      allSignals = [];
      conversations = [];
    }

    allSignals = allSignals.filter(s => !SKIP_RAW.has(s.signal_type));

    if (!allSignals.length) {
      document.getElementById('chart-signals').innerHTML = '<p style="text-align:center;color:var(--pico-muted-color);padding:3rem 0;">No check-ins yet. Start a conversation to see your data here.</p>';
      return;
    }

    renderChart(allSignals);
    initRangeButtons();
    initDetailClose();
  }

  function filterByRange(signals, range) {
    if (range === 'all') return signals;
    const now = new Date();
    const cutoff = new Date(now);
    if (range === 'week') cutoff.setDate(cutoff.getDate() - 7);
    if (range === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    const cutoffStr = cutoff.toISOString();
    return signals.filter(s => s.timestamp >= cutoffStr);
  }

  function renderChart(signals) {
    const convoSignals = signals.filter(s => CONVO_TYPES.has(s.signal_type));
    const voiceSignals = signals.filter(s => VOICE_TYPES.has(s.signal_type));

    const convoTypes = [...new Set(convoSignals.map(s => s.signal_type))];
    const voiceTypes = [...new Set(voiceSignals.map(s => s.signal_type))];

    const convoTraces = convoTypes.map(type => {
      const data = convoSignals.filter(s => s.signal_type === type);
      return {
        x: data.map(s => s.timestamp),
        y: data.map(s => s.value),
        type: 'scatter',
        mode: 'lines+markers',
        name: SIGNAL_LABELS[type] || type,
        line: { color: ALL_COLORS[type], width: 2, shape: 'spline' },
        marker: { size: 8 },
        hovertemplate: `<b>${SIGNAL_LABELS[type]}</b>: %{y}/10<br>%{x}<extra></extra>`,
      };
    });

    const voiceTraces = voiceTypes.map(type => {
      const data = voiceSignals.filter(s => s.signal_type === type);
      return {
        x: data.map(s => s.timestamp),
        y: data.map(s => s.value),
        type: 'scatter',
        mode: 'lines+markers',
        name: SIGNAL_LABELS[type] || type,
        line: { color: ALL_COLORS[type], width: 2, dash: 'dot', shape: 'spline' },
        marker: { size: 6, symbol: 'diamond' },
        yaxis: 'y2',
        hovertemplate: `<b>${SIGNAL_LABELS[type]}</b>: %{y}<br>%{x}<extra></extra>`,
      };
    });

    const layout = {
      yaxis: { range: [0, 10.5], title: 'Conversation Signals', dtick: 2 },
      yaxis2: {
        range: [0, 10.5],
        title: 'Voice Biomarkers',
        overlaying: 'y',
        side: 'right',
        showgrid: false,
      },
      xaxis: { title: '' },
      margin: { t: 20, r: 60, b: 50, l: 50 },
      height: 400,
      legend: { orientation: 'h', y: -0.2 },
      hovermode: 'closest',
    };

    Plotly.newPlot('chart-signals', [...convoTraces, ...voiceTraces], layout, { responsive: true, displayModeBar: false });

    const chartEl = document.getElementById('chart-signals');
    chartEl.on('plotly_click', (data) => {
      const point = data.points[0];
      const idx = point.pointIndex;
      const label = point.data.name;
      const typeKey = Object.entries(SIGNAL_LABELS).find(([k, v]) => v === label)?.[0] || label;
      const source = VOICE_TYPES.has(typeKey) ? voiceSignals : convoSignals;
      const matching = source.filter(s => s.signal_type === typeKey);
      const clicked = matching[idx];
      if (clicked) showDetail(clicked);
    });
  }

  async function showDetail(clickedSignal) {
    const convId = clickedSignal.conversation_id;
    const panel = document.getElementById('detail-panel');

    const dateStr = new Date(clickedSignal.timestamp).toLocaleDateString([], {
      weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    document.getElementById('detail-date').textContent = dateStr;

    const scoresEl = document.getElementById('detail-scores');
    scoresEl.innerHTML = '';
    const summaryEl = document.getElementById('detail-summary');
    const topicsEl = document.getElementById('detail-topics');
    summaryEl.textContent = '';
    topicsEl.innerHTML = '';

    if (convId) {
      try {
        const data = await fetch(`${BACKEND_URL}/conversations/${convId}/signals`).then(r => r.json());
        if (data && !data.error) {
          const convoTypes = ['mood', 'energy', 'stress', 'anxiety', 'sleep_quality'];
          for (const type of convoTypes) {
            const val = data[type];
            if (val == null) continue;
            const item = document.createElement('div');
            item.className = 'detail-score-item';
            item.innerHTML = `
              <div class="label">${SIGNAL_LABELS[type]}</div>
              <div class="value" style="color:${ALL_COLORS[type]}">${val}/10</div>
            `;
            scoresEl.appendChild(item);
          }

          if (data.voice_biomarkers && Object.keys(data.voice_biomarkers).length) {
            const divider = document.createElement('div');
            divider.className = 'detail-divider';
            divider.textContent = 'Voice Biomarkers';
            scoresEl.appendChild(divider);

            for (const [type, val] of Object.entries(data.voice_biomarkers)) {
              if (SKIP_RAW.has(type)) continue;
              const item = document.createElement('div');
              item.className = 'detail-score-item';
              const displayVal = typeof val === 'number' && val < 1 ? val.toFixed(4) : (typeof val === 'number' ? val.toFixed(1) : val);
              item.innerHTML = `
                <div class="label">${SIGNAL_LABELS[type] || type}</div>
                <div class="value" style="color:${ALL_COLORS[type] || '#06b6d4'}">${displayVal}</div>
              `;
              scoresEl.appendChild(item);
            }
          }

          if (data.summary) summaryEl.textContent = data.summary;
          if (data.topics) {
            data.topics.forEach(t => {
              const tag = document.createElement('span');
              tag.className = 'topic-tag';
              tag.textContent = t;
              topicsEl.appendChild(tag);
            });
          }
        }
      } catch {
        if (clickedSignal.context) summaryEl.textContent = clickedSignal.context;
      }
    }

    panel.classList.remove('hidden');
  }

  function initRangeButtons() {
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filtered = filterByRange(allSignals, btn.dataset.range);
        renderChart(filtered);
      });
    });
  }

  function initDetailClose() {
    document.getElementById('detail-close')?.addEventListener('click', () => {
      document.getElementById('detail-panel').classList.add('hidden');
    });
  }

  return { render };
})();
