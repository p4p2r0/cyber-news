# Cyber News

A live cybersecurity news website.

## How

1. **Frontend**: A static page (HTML/CSS/JS) hosted on GitHub Pages, no build step.
2. **Fetching**: Picking a source calls a small Cloudflare Worker, which fetches that source's RSS or Atom feed directly and parses it into clean JSON. This avoids browser CORS restrictions and lowers the chance of a source blocking the request.
3. **Caching**: The Worker caches each response for a few minutes at Cloudflare's edge, speeding up repeat visits.
4. **Pinning**: Articles can be pinned to the top of the list, saved in the browser's `localStorage`, so pins persist across visits with no login involved.

## Why

This falls under defensive security: a way for security professionals to keep track of current vulnerabilities, breaches, and industry activity in one place, without checking several sites individually every day.

## License

This project is licensed under the MIT License.
