const Dashboard = (() => {
  const BACKEND_URL = 'http://localhost:8000';

  const SIGNAL_COLORS = {
    mood: '#6366f1',
    energy: '#22c55e',
    stress: '#ef4444',
    anxiety: '#f59e0b',
    sleep_quality: '#8b5cf6',
  };

  const SIGNAL_LABELS = {
    mood: 'Mood',
    energy: 'Energy',
    stress: 'Stress',
    anxiety: 'Anxiety',
    sleep_quality: 'Sleep',
  };

  let allSignals = [];
  let conversations = [];

  async function render() {
    try {
      [allSignals, conversations] = await Promise.all([
        App.api.getSignals(),
        App.api.listConversations(),
      ]);
    } catch {
      allSignals = App.getMockDashboardData();
      conversations = [];
    }

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
    const types = [...new Set(signals.map(s => s.signal_type))];

    const traces = types.map(type => {
      const data = signals.filter(s => s.signal_type === type);
      return {
        x: data.map(s => s.timestamp),
        y: data.map(s => s.value),
        type: 'scatter',
        mode: 'lines+markers',
        name: SIGNAL_LABELS[type] || type,
        line: { color: SIGNAL_COLORS[type] || '#999', width: 2, shape: 'spline' },
        marker: { size: 8 },
        hovertemplate: `<b>${SIGNAL_LABELS[type] || type}</b>: %{y}/10<br>%{x}<extra></extra>`,
      };
    });

    const layout = {
      yaxis: { range: [0, 10.5], title: 'Score', dtick: 2 },
      xaxis: { title: '' },
      margin: { t: 20, r: 20, b: 50, l: 40 },
      height: 350,
      legend: { orientation: 'h', y: -0.2 },
      hovermode: 'closest',
    };

    Plotly.newPlot('chart-signals', traces, layout, { responsive: true, displayModeBar: false });

    const chartEl = document.getElementById('chart-signals');
    chartEl.on('plotly_click', (data) => {
      const point = data.points[0];
      const idx = point.pointIndex;
      const type = point.data.name;
      const typeKey = Object.entries(SIGNAL_LABELS).find(([k, v]) => v === type)?.[0] || type;
      const matching = allSignals.filter(s => s.signal_type === typeKey);
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

    const pointSignals = allSignals.filter(s => s.conversation_id === convId);

    const scoresEl = document.getElementById('detail-scores');
    scoresEl.innerHTML = '';
    const allTypes = ['mood', 'energy', 'stress', 'anxiety', 'sleep_quality'];
    for (const type of allTypes) {
      const sig = pointSignals.find(s => s.signal_type === type);
      if (!sig) continue;
      const item = document.createElement('div');
      item.className = 'detail-score-item';
      item.innerHTML = `
        <div class="label">${SIGNAL_LABELS[type]}</div>
        <div class="value" style="color:${SIGNAL_COLORS[type]}">${sig.value}/10</div>
        <div class="label">${sig.label || ''}</div>
      `;
      scoresEl.appendChild(item);
    }

    const summaryEl = document.getElementById('detail-summary');
    const topicsEl = document.getElementById('detail-topics');
    summaryEl.textContent = '';
    topicsEl.innerHTML = '';

    if (convId) {
      try {
        const data = await fetch(`${BACKEND_URL}/conversations/${convId}/signals`).then(r => r.json());
        if (data && !data.error) {
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
