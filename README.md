# cyber-news

A cybersecurity news website.

**[Visit the website](https://p4p2r0.github.io/cyber-news)**

## Why

Keep track of current vulnerabilities, breaches, and industry activity in one place, without checking several sites individually every day.

## How it works

- **Frontend**: A static page (HTML/CSS/JS) hosted on GitHub Pages, no build step.
- **Source picker**: Pick one source at a time; the last choice is remembered locally.
- **Fetching**: `worker.js` runs separately as a Cloudflare Worker, deployed through Cloudflare's dashboard rather than GitHub Pages. It fetches the chosen source's RSS or Atom feed directly and parses it into clean JSON, avoiding browser CORS restrictions and lowering the chance of a source blocking the request.
- **Caching**: The Worker caches each response for 3 minutes at Cloudflare's edge, so content updates at most every 3 minutes in exchange for fewer requests to the source and faster repeat visits.
- **Pinning**: Articles can be pinned to the top of the list, saved in the browser's `localStorage`, so pins persist across visits with no login involved.

## License

This project is licensed under the [MIT License](LICENSE).

