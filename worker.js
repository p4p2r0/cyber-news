const SOURCES = {
    thn:      { label: 'The Hacker News',      rss: 'https://thehackernews.com/feeds/posts/default' },
    cisa:     { label: 'CISA Advisories',      rss: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' },
    darkread: { label: 'Dark Reading',         rss: 'https://www.darkreading.com/rss.xml' },
    cluley:   { label: 'Graham Cluley',        rss: 'https://grahamcluley.com/feed/' },
    krebs:    { label: 'Krebs on Security',    rss: 'https://krebsonsecurity.com/feed/' },
    sansisc:  { label: 'SANS ISC Diary',       rss: 'https://isc.sans.edu/rssfeed_full.xml' },
    schneier: { label: 'Schneier on Security', rss: 'https://www.schneier.com/feed/atom/' },
    secweek:  { label: 'SecurityWeek',         rss: 'https://www.securityweek.com/feed/' },
};

const ALLOWED_ORIGINS = [
    'https://p4p2r0.github.io',
];

function corsHeadersFor(origin) {
    const allowed = origin === 'null' || /^https?:\/\/localhost(:\d+)?$/.test(origin || '') || ALLOWED_ORIGINS.includes(origin);
    return {
        'Access-Control-Allow-Origin': allowed ? origin : 'null',
        'Content-Type': 'application/json',
    };
}

function decodeEntities(str) {
    return str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractTag(block, tag) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? decodeEntities(match[1]) : '';
}

function extractAtomLink(block) {
    const links = [...block.matchAll(/<link\b([^>]*)\/?>(?:<\/link>)?/gi)];
    for (const link of links) {
        const attrs = link[1];
        if (/rel=["']alternate["']/.test(attrs) || !/rel=/.test(attrs)) {
            const href = attrs.match(/href=["']([^"']+)["']/);
            if (href) return href[1];
        }
    }
    if (links.length > 0) {
        const href = links[0][1].match(/href=["']([^"']+)["']/);
        if (href) return href[1];
    }
    return '#';
}

function cleanTitle(title) {
    return title
        .replace(/https?:\/\/\S+/g, '')
        .replace(/,?\s*\([^()]*\)\s*$/, '')
        .replace(/\s*\bFor\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseFeed(xml) {
    const rssItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
    if (rssItems.length > 0) {
        return rssItems.map(m => ({
            title: cleanTitle(extractTag(m[1], 'title')) || '(no title)',
            link: extractTag(m[1], 'link') || '#',
            pubDate: extractTag(m[1], 'pubDate'),
        }));
    }

    const atomEntries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
    return atomEntries.map(m => ({
        title: cleanTitle(extractTag(m[1], 'title')) || '(no title)',
        link: extractAtomLink(m[1]),
        pubDate: extractTag(m[1], 'updated') || extractTag(m[1], 'published'),
    }));
}

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        const headers = corsHeadersFor(origin);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        const url = new URL(request.url);
        const sourceId = url.searchParams.get('source');
        const src = SOURCES[sourceId];

        if (!src) {
            return new Response(JSON.stringify({ ok: false, error: 'unknown source id' }), {
                status: 400,
                headers,
            });
        }

        let cache = null;
        let cacheKey = null;
        try {
            cache = caches.default;
            cacheKey = new Request(url.toString() + '&_o=' + encodeURIComponent(origin || ''), request);
            const cached = await cache.match(cacheKey);
            if (cached) return cached;
        } catch (e) {
            cache = null;
        }

        try {
            const res = await fetch(src.rss, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cyber-news-worker/1.0)' },
            });
            if (!res.ok) throw new Error('upstream HTTP ' + res.status);

            const xml = await res.text();
            const items = parseFeed(xml).slice(0, 60);

            const response = new Response(JSON.stringify({
                ok: true,
                label: src.label,
                fetchedAt: new Date().toISOString(),
                items,
            }), {
                headers: { ...headers, 'Cache-Control': 'public, max-age=180' },
            });

            if (cache && cacheKey) {
                try {
                    ctx.waitUntil(cache.put(cacheKey, response.clone()));
                } catch (e) {}
            }

            return response;
        } catch (e) {
            return new Response(JSON.stringify({ ok: false, label: src.label, error: e.message }), {
                headers,
            });
        }
    },
};