const Dashboard = (() => {
  async function render() {
    let signals;
    try {
      signals = await App.api.getSignals();
      if (!signals.length) signals = App.getMockDashboardData();
    } catch {
      signals = App.getMockDashboardData();
    }
    renderSummaryCards(signals);
    renderMoodChart(signals);
    renderEnergyStressChart(signals);
    renderTopics();
  }

  function filterByType(signals, type) {
    return signals.filter(s => s.signal_type === type);
  }

  function renderSummaryCards(signals) {
    const latest = {};
    for (const s of signals) {
      if (!latest[s.signal_type] || s.timestamp > latest[s.signal_type].timestamp) {
        latest[s.signal_type] = s;
      }
    }

    const moodEl = document.getElementById('mood-score');
    const energyEl = document.getElementById('energy-score');
    const stressEl = document.getElementById('stress-score');

    moodEl.textContent = latest.mood ? `${latest.mood.value}/10` : '--';
    energyEl.textContent = latest.energy ? `${latest.energy.value}/10` : '--';
    stressEl.textContent = latest.stress ? `${latest.stress.value}/10` : '--';

    renderTrend('mood-trend', filterByType(signals, 'mood'));
    renderTrend('energy-trend', filterByType(signals, 'energy'));
    renderTrend('stress-trend', filterByType(signals, 'stress'));
  }

  function renderTrend(elementId, data) {
    if (data.length < 2) return;
    const recent = data.slice(-3);
    const older = data.slice(-6, -3);
    if (older.length === 0) return;

    const recentAvg = recent.reduce((s, d) => s + d.value, 0) / recent.length;
    const olderAvg = older.reduce((s, d) => s + d.value, 0) / older.length;
    const diff = recentAvg - olderAvg;

    const el = document.getElementById(elementId);
    if (Math.abs(diff) < 0.5) {
      el.textContent = 'Stable';
    } else if (diff > 0) {
      el.textContent = `+${diff.toFixed(1)} trending up`;
    } else {
      el.textContent = `${diff.toFixed(1)} trending down`;
    }
  }

  function renderMoodChart(signals) {
    const mood = filterByType(signals, 'mood');
    const trace = {
      x: mood.map(s => s.timestamp),
      y: mood.map(s => s.value),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Mood',
      line: { color: '#6366f1', width: 2, shape: 'spline' },
      marker: { size: 6 },
      fill: 'tozeroy',
      fillcolor: 'rgba(99, 102, 241, 0.1)',
    };

    const layout = {
      title: { text: 'Mood Over Time', font: { size: 14 } },
      yaxis: { range: [0, 10], title: 'Score' },
      xaxis: { title: '' },
      margin: { t: 40, r: 20, b: 40, l: 40 },
      height: 280,
    };

    Plotly.newPlot('chart-mood', [trace], layout, { responsive: true, displayModeBar: false });
  }

  function renderEnergyStressChart(signals) {
    const energy = filterByType(signals, 'energy');
    const stress = filterByType(signals, 'stress');

    const energyTrace = {
      x: energy.map(s => s.timestamp),
      y: energy.map(s => s.value),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Energy',
      line: { color: '#22c55e', width: 2, shape: 'spline' },
      marker: { size: 5 },
    };

    const stressTrace = {
      x: stress.map(s => s.timestamp),
      y: stress.map(s => s.value),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Stress',
      line: { color: '#ef4444', width: 2, shape: 'spline' },
      marker: { size: 5 },
    };

    const layout = {
      title: { text: 'Energy vs Stress', font: { size: 14 } },
      yaxis: { range: [0, 10], title: 'Score' },
      xaxis: { title: '' },
      margin: { t: 40, r: 20, b: 40, l: 40 },
      height: 280,
      legend: { orientation: 'h', y: -0.15 },
    };

    Plotly.newPlot('chart-energy-stress', [energyTrace, stressTrace], layout, { responsive: true, displayModeBar: false });
  }

  function renderTopics() {
    const topics = ['work', 'sleep', 'exercise', 'relationships', 'food', 'deadline', 'meetings'];
    const container = document.getElementById('topics-tags');
    container.innerHTML = '';
    topics.forEach(topic => {
      const tag = document.createElement('span');
      tag.className = 'topic-tag';
      tag.textContent = topic;
      container.appendChild(tag);
    });
  }

  return { render };
})();
