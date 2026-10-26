/**
 * LinkedIn Outreach Cards — Frontend Application Logic
 * Renders interactive cards for 508 live connections with 3 message drafts,
 * quick clipboard copy, direct LinkedIn links, and Chrome CDP staging.
 */

// Application State
const state = {
  category: 'all',
  status: 'all',
  search: '',
  sort: 'score_desc',
  hideMessaged: false,
  limit: 60,
  offset: 0,
  total: 0,
  counts: {},
  connections: [],
  isLoading: false,
};

// DOM References
const elements = {
  grid: document.getElementById('connections-grid'),
  loadingState: document.getElementById('loading-state'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  sortSelect: document.getElementById('sort-select'),
  toggleUncontacted: document.getElementById('toggle-uncontacted'),
  resultsCount: document.getElementById('results-count'),
  resultsFilterBadge: document.getElementById('results-filter-badge'),
  loadMoreContainer: document.getElementById('load-more-container'),
  btnLoadMore: document.getElementById('btn-load-more'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  categoryPills: document.getElementById('category-pills'),
  totalLiveCount: document.getElementById('total-live-count'),
  toastContainer: document.getElementById('toast-container'),
  btnSyncChrome: document.getElementById('btn-sync-chrome'),
  syncBtnLabel: document.getElementById('sync-btn-label'),
  cdpStatusPill: document.getElementById('cdp-status-pill'),
};

// Category Pill Count Elements Map
const countElementIds = {
  all: 'count-all',
  hiring: 'count-hiring',
  founder: 'count-founder',
  recruiter: 'count-recruiter',
  cto: 'count-cto',
  ai_ml_lead: 'count-ai_ml_lead',
  cfo_coo: 'count-cfo_coo',
  starred: 'count-starred',
  messaged: 'count-messaged',
};

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Helper to get clean initials from a full name
 */
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get visual styling configuration based on role category
 */
function getRoleBadgeConfig(roleCategory = '', title = '') {
  const text = `${roleCategory} ${title}`.toLowerCase();
  if (text.includes('founder') || text.includes('ceo')) {
    return { label: 'Founder / CEO', badgeClass: 'badge-founder', avatarClass: 'avatar-founder' };
  }
  if (text.includes('recruiter') || text.includes('talent')) {
    return { label: 'Recruiter', badgeClass: 'badge-recruiter', avatarClass: 'avatar-recruiter' };
  }
  if (text.includes('cto') || text.includes('chief technology')) {
    return { label: 'CTO / Visionary', badgeClass: 'badge-cto', avatarClass: 'avatar-cto' };
  }
  if (text.includes('ai') || text.includes('machine learning') || text.includes('ml lead')) {
    return { label: 'AI/ML Lead', badgeClass: 'badge-ai', avatarClass: 'avatar-ai' };
  }
  if (text.includes('cfo') || text.includes('coo') || text.includes('cro')) {
    return { label: 'C-Level Exec', badgeClass: 'badge-exec', avatarClass: 'avatar-exec' };
  }
  return { label: 'Tech Builder', badgeClass: 'badge-other', avatarClass: '' };
}

/**
 * Fetch connections from server API
 */
async function fetchConnections(append = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (!append) {
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    elements.grid.innerHTML = '';
  }

  try {
    const params = new URLSearchParams({
      category: state.category,
      status: state.hideMessaged ? 'new' : state.status,
      search: state.search,
      sort: state.sort,
      limit: state.limit,
      offset: state.offset,
    });

    const res = await fetch(`/api/connections?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    state.total = data.total || 0;
    state.counts = data.counts || {};

    if (append) {
      state.connections = state.connections.concat(data.connections || []);
    } else {
      state.connections = data.connections || [];
    }

    renderPillCounts();
    renderCards(append);
  } catch (err) {
    console.error('Failed to load connections:', err);
    showToast(`Failed to load connections: ${err.message}`, 'warning');
  } finally {
    state.isLoading = false;
    elements.loadingState.style.display = 'none';
  }
}

/**
 * Update numbers inside navigation filter pills
 */
function renderPillCounts() {
  if (elements.totalLiveCount && state.counts.all) {
    elements.totalLiveCount.textContent = `${state.counts.all} Connections`;
  }

  for (const [cat, elId] of Object.entries(countElementIds)) {
    const el = document.getElementById(elId);
    if (el && state.counts[cat] !== undefined) {
      el.textContent = state.counts[cat];
    }
  }

  // Update results counter
  elements.resultsCount.innerHTML = `Showing <strong>${state.connections.length}</strong> of <strong>${state.total}</strong> connections`;
}

/**
 * Render all Connection Cards into the DOM
 */
function renderCards(append = false) {
  if (state.connections.length === 0) {
    elements.emptyState.style.display = 'flex';
    elements.loadMoreContainer.style.display = 'none';
    return;
  }

  elements.emptyState.style.display = 'none';

  const fragment = document.createDocumentFragment();

  // If appending, only render the newly loaded slice
  const startIndex = append ? state.connections.length - (state.total % state.limit || state.limit) : 0;
  const itemsToRender = append ? state.connections.slice(startIndex) : state.connections;

  for (const c of itemsToRender) {
    const card = createConnectionCard(c);
    fragment.appendChild(card);
  }

  if (append) {
    elements.grid.appendChild(fragment);
  } else {
    elements.grid.innerHTML = '';
    elements.grid.appendChild(fragment);
  }

  // Show or hide "Load More" button
  if (state.connections.length < state.total) {
    elements.loadMoreContainer.style.display = 'flex';
  } else {
    elements.loadMoreContainer.style.display = 'none';
  }
}

/**
 * Create a single outreach card DOM element
 */
function createConnectionCard(c) {
  const card = document.createElement('article');
  card.className = `outreach-card ${c.status === 'contacted' ? 'is-contacted' : ''}`;
  card.dataset.id = c.id;

  const roleConfig = getRoleBadgeConfig(c.role_category, c.title);
  const initials = getInitials(c.name);
  const scoreClass = c.relevance_score === 100 ? 'score-100' : '';
  const isHiring = /\b(hiring|we're hiring|we are hiring|join our team|talent acquisition|recruiter|recruiting|head of people|talent partner)\b/i.test(`${c.title} ${c.company} ${c.score_explanation || ''}`);

  // Message draft variants
  const conciseDraft = c.messages?.concise || '';
  const valueFirstDraft = c.messages?.value_first || '';
  const conversationalDraft = c.messages?.conversational || '';

  card.innerHTML = `
    <!-- Header: Avatar, Name, LinkedIn Link, Star -->
    <div class="card-header">
      <div class="card-person">
        <div class="person-avatar ${roleConfig.avatarClass}">
          ${initials}
        </div>
        <div class="person-meta">
          <div class="person-name-row">
            <a href="${c.linkedin_url}" target="_blank" rel="noopener noreferrer" class="person-name" title="Open ${c.name}'s LinkedIn profile">
              ${c.name}
            </a>
            <a href="${c.linkedin_url}" target="_blank" rel="noopener noreferrer" class="open-linkedin-icon" title="Open LinkedIn Profile">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
          <span class="person-company-sub" style="font-size: 0.8rem; color: #94a3b8;">${c.company || 'Tech Industry'}</span>
        </div>
      </div>

      <div class="card-header-actions">
        <button class="btn-star ${c.is_starred ? 'starred' : ''}" title="Toggle Star / Priority">
          ${c.is_starred ? '★' : '☆'}
        </button>
      </div>
    </div>

    <!-- Badges Row: Role, Company, Score -->
    <div class="card-badges">
      ${isHiring ? `<span class="badge-hiring-indicator" title="Actively hiring or key talent partner">🔥 Actively Hiring</span>` : ''}
      <span class="badge-role ${roleConfig.badgeClass}">
        ${roleConfig.label}
      </span>
      ${c.company ? `<span class="badge-company">${c.company}</span>` : ''}
      <span class="badge-score ${scoreClass}" title="${c.score_explanation || 'Relevance Score'}">
        ⚡ ${c.relevance_score}/100
      </span>
    </div>

    <!-- Exact Headline -->
    <p class="card-headline" title="${c.title || ''}">${c.title || 'Tech Professional'}</p>

    <!-- AI Relevance Reason -->
    <div class="card-reason-box">
      <strong>Why shortlisted:</strong> ${c.relevance_reason || 'Strong alignment with your AI engineering and startup focus.'}
    </div>

    <!-- Message Studio -->
    <div class="card-msg-studio">
      <div class="msg-tabs">
        <button class="msg-tab active" data-tab="concise">⚡ Concise (&lt;75w)</button>
        <button class="msg-tab" data-tab="value_first">💡 Value-First</button>
        <button class="msg-tab" data-tab="conversational">🤝 Conversational</button>
      </div>

      <div class="msg-textarea-wrapper">
        <textarea class="msg-textarea" aria-label="Personalized message draft">${conciseDraft}</textarea>
        <span class="msg-char-count">${conciseDraft.split(/\s+/).filter(Boolean).length} words</span>
      </div>

      <!-- Actions Bar -->
      <div class="card-actions-bar">
        <div class="card-actions-left">
          <button class="btn-card-action btn-copy" title="Copy draft to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy Message</span>
          </button>

          <a href="${c.linkedin_url}" target="_blank" rel="noopener noreferrer" class="btn-card-action btn-linkedin-msg" title="Open LinkedIn Profile & message them">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            <span>Open & Message</span>
          </a>

          <button class="btn-card-action btn-stage-chrome" title="Auto-fill message into your open Chrome LinkedIn chat window via CDP">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5h-2v-2h2zm0-4.5h-2V7h2z"/></svg>
            <span>Auto-Fill Chrome</span>
          </button>
        </div>

        <div class="card-actions-right">
          <button class="btn-card-action btn-mark-status ${c.status === 'contacted' ? 'is-messaged' : ''}" title="Toggle Contacted status">
            ${c.status === 'contacted' ? '✓ Messaged' : 'Mark Messaged'}
          </button>
        </div>
      </div>
    </div>
  `;

  // --- Attach Card Event Listeners ---

  const textarea = card.querySelector('.msg-textarea');
  const charCount = card.querySelector('.msg-char-count');
  const tabs = card.querySelectorAll('.msg-tab');
  const btnCopy = card.querySelector('.btn-copy');
  const btnStage = card.querySelector('.btn-stage-chrome');
  const btnMark = card.querySelector('.btn-mark-status');
  const btnStar = card.querySelector('.btn-star');

  // Textarea word count updates on input
  textarea.addEventListener('input', () => {
    const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    charCount.textContent = `${words} words`;
  });

  // Tab switching between message drafts
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabType = tab.dataset.tab;
      if (tabType === 'concise') textarea.value = conciseDraft;
      if (tabType === 'value_first') textarea.value = valueFirstDraft;
      if (tabType === 'conversational') textarea.value = conversationalDraft;

      const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
      charCount.textContent = `${words} words`;
    });
  });

  // Copy Message to Clipboard
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      btnCopy.classList.add('copied');
      btnCopy.querySelector('span').textContent = 'Copied!';
      showToast(`Copied outreach message for ${c.name}!`, 'success');
      setTimeout(() => {
        btnCopy.classList.remove('copied');
        btnCopy.querySelector('span').textContent = 'Copy Message';
      }, 2000);
    } catch (err) {
      showToast('Could not copy to clipboard automatically.', 'warning');
    }
  });

  // Auto-Fill into open Chrome Tab via CDP
  btnStage.addEventListener('click', async () => {
    btnStage.disabled = true;
    btnStage.querySelector('span').textContent = 'Staging...';
    try {
      const res = await fetch('/api/connections/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_text: textarea.value })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Draft staged into your Chrome LinkedIn tab!`, 'success');
      } else {
        showToast(data.reason || 'Make sure message box is open in Chrome.', 'info');
      }
    } catch (err) {
      showToast(`Staging error: ${err.message}`, 'warning');
    } finally {
      btnStage.disabled = false;
      btnStage.querySelector('span').textContent = 'Auto-Fill Chrome';
    }
  });

  // Toggle Messaged Status
  btnMark.addEventListener('click', async () => {
    const isContacted = c.status === 'contacted';
    const newStatus = isContacted ? 'new' : 'contacted';

    try {
      const res = await fetch(`/api/connections/${c.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        c.status = newStatus;
        if (newStatus === 'contacted') {
          btnMark.classList.add('is-messaged');
          btnMark.textContent = '✓ Messaged';
          card.classList.add('is-contacted');
          showToast(`Marked ${c.name} as messaged!`, 'success');
        } else {
          btnMark.classList.remove('is-messaged');
          btnMark.textContent = 'Mark Messaged';
          card.classList.remove('is-contacted');
          showToast(`Marked ${c.name} as uncontacted`, 'info');
        }
      }
    } catch (err) {
      showToast('Could not update status', 'warning');
    }
  });

  // Toggle Star / Favorite
  btnStar.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/connections/${c.id}/star`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        c.is_starred = data.is_starred;
        if (c.is_starred) {
          btnStar.classList.add('starred');
          btnStar.textContent = '★';
          showToast(`Added ${c.name} to Starred!`, 'success');
        } else {
          btnStar.classList.remove('starred');
          btnStar.textContent = '☆';
        }
      }
    } catch (err) {
      showToast('Could not toggle star', 'warning');
    }
  });

  return card;
}

/**
 * Setup Global Event Handlers
 */
function initEvents() {
  // Category Pill Filters
  elements.categoryPills.addEventListener('click', (e) => {
    const pill = e.target.closest('.nav-pill');
    if (!pill) return;

    document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    state.category = pill.dataset.category;
    state.offset = 0;
    fetchConnections(false);
  });

  // Live Search with debounce
  let searchTimeout = null;
  elements.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = elements.searchInput.value.trim();
    elements.searchClearBtn.style.display = query ? 'block' : 'none';

    searchTimeout = setTimeout(() => {
      state.search = query;
      state.offset = 0;
      fetchConnections(false);
    }, 280);
  });

  // Clear Search
  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.searchClearBtn.style.display = 'none';
    state.search = '';
    state.offset = 0;
    fetchConnections(false);
  });

  // Sort select
  elements.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.offset = 0;
    fetchConnections(false);
  });

  // Hide Messaged toggle
  elements.toggleUncontacted.addEventListener('change', (e) => {
    state.hideMessaged = e.target.checked;
    state.offset = 0;
    fetchConnections(false);
  });

  // Load More Button
  elements.btnLoadMore.addEventListener('click', () => {
    state.offset += state.limit;
    fetchConnections(true);
  });

  // Reset Filters Button
  elements.btnResetFilters.addEventListener('click', () => {
    state.category = 'all';
    state.search = '';
    state.hideMessaged = false;
    elements.searchInput.value = '';
    elements.searchClearBtn.style.display = 'none';
    elements.toggleUncontacted.checked = false;

    document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
    document.getElementById('pill-all')?.classList.add('active');

    state.offset = 0;
    fetchConnections(false);
  });

  // Sync Connections from Chrome Button
  if (elements.btnSyncChrome) {
    elements.btnSyncChrome.addEventListener('click', async () => {
      if (elements.btnSyncChrome.disabled) return;
      elements.btnSyncChrome.disabled = true;
      const originalLabel = elements.syncBtnLabel.textContent;
      elements.syncBtnLabel.textContent = 'Syncing Feed...';
      showToast('Connecting to Chrome and discovering connections... (this may take ~30-45s)', 'info', 6000);

      try {
        const res = await fetch('/api/connections/sync', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(`Successfully synced ${data.count} connections from Chrome!`, 'success', 5000);
          state.offset = 0;
          fetchConnections(false);
          checkChromeStatus();
        } else {
          showToast(data.error || 'Failed to sync from Chrome', 'warning', 6000);
        }
      } catch (err) {
        showToast(`Sync error: ${err.message}`, 'warning', 5000);
      } finally {
        elements.btnSyncChrome.disabled = false;
        elements.syncBtnLabel.textContent = originalLabel;
      }
    });
  }
}

/**
 * Check whether Chrome is open and running with CDP on port 9222
 */
async function checkChromeStatus() {
  if (!elements.cdpStatusPill) return;
  try {
    const res = await fetch('/api/connections/chrome-status');
    const data = await res.json();
    if (data.connected) {
      elements.cdpStatusPill.className = 'cdp-status-pill';
      elements.cdpStatusPill.innerHTML = '<span class="cdp-dot"></span><span>Chrome CDP Connected</span>';
      elements.cdpStatusPill.title = data.tabTitle ? `Active Tab: ${data.tabTitle}` : 'Chrome remote debugging connected on port 9222';
    } else {
      elements.cdpStatusPill.className = 'cdp-status-pill cdp-disconnected';
      elements.cdpStatusPill.innerHTML = '<span class="cdp-dot" style="background:#f43f5e;"></span><span style="color:#f43f5e;">Chrome Offline</span>';
      elements.cdpStatusPill.title = 'Start Chrome with --remote-debugging-port=9222 to enable live sync';
    }
  } catch (err) {
    // ignore
  }
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  fetchConnections(false);
  checkChromeStatus();
});
