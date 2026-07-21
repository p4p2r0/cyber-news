const WORKER_URL = 'https://cyber-news.p4p2r0-b1d.workers.dev';

const SOURCES = [
    { id: 'thn',      label: 'The Hacker News' },
    { id: 'cisa',     label: 'CISA Advisories' },
    { id: 'darkread', label: 'Dark Reading' },
    { id: 'cluley',   label: 'Graham Cluley' },
    { id: 'krebs',    label: 'Krebs on Security' },
    { id: 'sansisc',  label: 'SANS ISC Diary' },
    { id: 'schneier', label: 'Schneier on Security' },
    { id: 'secweek',  label: 'SecurityWeek' },
].sort((a, b) => a.label.localeCompare(b.label));

const DEFAULT_SOURCE = 'thn';
const REFRESH_MS = 60000;
const STORAGE_KEY = 'cybernews_pins';
const LAST_SOURCE_KEY = 'cybernews_last_source';

const feedList = document.getElementById('feed-list');
const pinnedSection = document.getElementById('pinned-section');
const pinnedList = document.getElementById('pinned-list');
const indicator = document.getElementById('live-indicator');
const sourceSelect = document.getElementById('source-select');
const syncInfo = document.getElementById('sync-info');

let currentSource = localStorage.getItem(LAST_SOURCE_KEY) || DEFAULT_SOURCE;
if (!SOURCES.some(s => s.id === currentSource)) currentSource = DEFAULT_SOURCE;
let refreshTimer = null;
let pins = loadPins();

function loadPins() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function savePins() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch (e) {}
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function shortDate(pubDate) {
    const d = new Date(pubDate);
    return isNaN(d) ? (pubDate || '') : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeAgo(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

function makeNewsBox(item, sourceLabel) {
    const key = item.link;
    const isPinned = !!pins[key];

    const box = document.createElement('div');
    box.className = 'news-box';

    const main = document.createElement('div');
    main.className = 'news-main';
    main.innerHTML = `
        <a class="news-title" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
        <div class="meta">Source: ${escapeHtml(sourceLabel)} | ${escapeHtml(shortDate(item.pubDate))}</div>
    `;

    const btn = document.createElement('button');
    btn.className = 'pin-btn' + (isPinned ? ' pinned' : '');
    btn.textContent = isPinned ? '★' : '☆';
    btn.title = isPinned ? 'Unpin' : 'Pin to top';
    btn.addEventListener('click', () => togglePin(item, sourceLabel));

    box.appendChild(main);
    box.appendChild(btn);
    return box;
}

function togglePin(item, sourceLabel) {
    const key = item.link;
    if (pins[key]) {
        delete pins[key];
    } else {
        pins[key] = {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            sourceLabel: sourceLabel,
            pinnedAt: Date.now(),
        };
    }
    savePins();
    renderPinned();
    refreshPinIcons();
}

function refreshPinIcons() {
    feedList.querySelectorAll('.news-box').forEach(box => {
        const link = box.querySelector('.news-title')?.getAttribute('href');
        const btn = box.querySelector('.pin-btn');
        if (!link || !btn) return;
        const isPinned = !!pins[link];
        btn.classList.toggle('pinned', isPinned);
        btn.textContent = isPinned ? '★' : '☆';
        btn.title = isPinned ? 'Unpin' : 'Pin to top';
    });
}

function renderPinned() {
    const entries = Object.values(pins).sort((a, b) => b.pinnedAt - a.pinnedAt);
    pinnedList.innerHTML = '';

    if (entries.length === 0) {
        pinnedSection.classList.add('hidden');
        return;
    }

    pinnedSection.classList.remove('hidden');
    entries.forEach(entry => {
        pinnedList.appendChild(makeNewsBox(entry, entry.sourceLabel));
    });
}

function renderFeed(items, sourceLabel) {
    const sorted = [...items].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const fresh = document.createDocumentFragment();
    sorted.forEach(item => fresh.appendChild(makeNewsBox(item, sourceLabel)));
    feedList.replaceChildren(fresh);
}

async function loadFeed({ silent } = {}) {
    const src = SOURCES.find(s => s.id === currentSource);
    if (!silent) syncInfo.textContent = 'syncing...';

    try {
        const res = await fetch(`${WORKER_URL}/?source=${currentSource}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'source reported failure');

        renderFeed(data.items, data.label);
        indicator.textContent = '● LIVE';
        indicator.className = 'status live';
        const syncTime = new Date().toLocaleTimeString();
        const fetchTime = data.fetchedAt ? timeAgo(data.fetchedAt) : 'unknown';
        syncInfo.textContent = `sync: ${syncTime} | fetch: ${fetchTime}`;
    } catch (e) {
        indicator.textContent = '● OFFLINE';
        indicator.className = 'status offline';
        syncInfo.textContent = 'sync failed: ' + e.message;
        if (feedList.children.length === 0) {
            feedList.innerHTML = `<div class="meta">Could not load ${escapeHtml(src.label)}. Try another source.</div>`;
        }
    }
}

function renderSourceSelect() {
    SOURCES.forEach(src => {
        const opt = document.createElement('option');
        opt.value = src.id;
        opt.textContent = src.label;
        if (src.id === currentSource) opt.selected = true;
        sourceSelect.appendChild(opt);
    });

    sourceSelect.addEventListener('change', () => {
        currentSource = sourceSelect.value;
        localStorage.setItem(LAST_SOURCE_KEY, currentSource);
        feedList.innerHTML = '<div class="meta">Loading...</div>';
        loadFeed();
    });
}

function scheduleRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => loadFeed({ silent: true }), REFRESH_MS);
}

renderSourceSelect();
renderPinned();
loadFeed();
scheduleRefresh();