// NewsHub - improved and fixed JavaScript
// NOTE: If you want live data, replace the API_KEY below with your NewsAPI key.
// Be aware: NewsAPI may block requests from some browsers (CORS) or reject keys from client-side use.
// This app includes a built-in sample fallback so the UI remains functional offline.

class NewsApp {
    constructor() {
        // Replace with your NewsAPI key if you want live data
        this.API_KEY = "5d1d4225801b446ca3927c077087ab5b";
        this.BASE_URL = "https://newsapi.org/v2";

        this.state = {
            category: "general",
            page: 1,
            loading: false,
            query: "",
            articles: [],
            totalResults: Infinity
        };

        // Sample fallback articles (used when network/API fails)
        this.sampleArticles = [
            {
                source: { name: "Demo Source" },
                author: "Reporter A",
                title: "Demo: Breakthrough in renewable energy",
                description: "A short description of the renewable energy breakthrough for demo purposes.",
                url: "https://example.com/demo-renewable-energy",
                urlToImage: "",
                publishedAt: new Date().toISOString()
            },
            {
                source: { name: "Demo Source" },
                author: "Reporter B",
                title: "Demo: AI helps doctors diagnose faster",
                description: "A short description about AI in healthcare.",
                url: "https://example.com/demo-ai-health",
                urlToImage: "",
                publishedAt: new Date().toISOString()
            },
            {
                source: { name: "Demo News" },
                title: "Demo: Local community plants 1000 trees",
                description: "Community initiative to green the neighborhood.",
                url: "https://example.com/demo-trees",
                urlToImage: "",
                publishedAt: new Date().toISOString()
            }
        ];

        this.debounceTimer = null;
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEvents();
        this.loadNews();
    }

    setupTheme() {
        const theme = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", theme);
        document.getElementById("themeIcon").textContent = theme === "dark" ? "☀" : "🌙";

        document.getElementById("themeToggle").addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            const newTheme = current === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            document.getElementById("themeIcon").textContent = newTheme === "dark" ? "☀" : "🌙";
        });
    }

    setupEvents() {
        document.querySelectorAll(".category-btn").forEach((btn) => {
            btn.addEventListener("click", () => this.changeCategory(btn.dataset.category));
        });

        const searchInput = document.getElementById("searchInput");
        searchInput.addEventListener("input", (e) => {
            // debounce to avoid firing request on every keystroke
            clearTimeout(this.debounceTimer);
            const value = e.target.value.trim();
            this.debounceTimer = setTimeout(() => {
                this.search(value);
            }, 450);
        });

        // Infinite scroll
        window.addEventListener("scroll", () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 600 && !this.state.loading) {
                if (this.state.articles.length < this.state.totalResults) {
                    this.loadMore();
                } else {
                    this.showEndMessage();
                }
            }
        });

        // Open article on click (delegated)
        document.getElementById("newsGrid").addEventListener("click", (e) => {
            const card = e.target.closest(".news-card");
            if (card && card.dataset.url) {
                window.open(card.dataset.url, "_blank");
            }
        });
    }

    changeCategory(category) {
        if (category === this.state.category) return;
        document.querySelectorAll(".category-btn").forEach((btn) => btn.classList.remove("active"));
        const target = document.querySelector(`[data-category="${category}"]`);
        if (target) target.classList.add("active");

        this.resetState({ category, query: "" });
        document.getElementById("searchInput").value = "";
        this.loadNews();
    }

    search(query) {
        this.resetState({ query });
        this.loadNews();
    }

    async loadNews() {
        if (this.state.loading) return;
        this.hideEndMessage();
        this.toggleLoading(true);

        try {
            const url = this.buildUrl();
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.status === "ok" && Array.isArray(data.articles)) {
                if (data.articles.length === 0) {
                    this.showError("No news found for your query.");
                    // fallback to sample articles so UI remains visible
                    this.useSampleData("No news found. Showing sample articles.");
                } else {
                    this.state.articles = data.articles;
                    this.state.totalResults = data.totalResults || data.articles.length;
                    this.renderNews(this.state.articles);
                    this.hideError();
                }
            } else {
                // If API returns error, show message and fallback
                const msg = data && data.message ? data.message : "Failed to fetch live news.";
                this.showError(msg + " Showing sample articles.");
                this.useSampleData(msg);
            }
        } catch (error) {
            console.warn("Fetch failed:", error);
            this.showError("Failed to fetch news (network/CORS/API). Showing sample articles.");
            this.useSampleData("Network/CORS/API error - sample articles shown.");
        } finally {
            this.toggleLoading(false);
        }
    }

    useSampleData(message) {
        // show the sample articles as a friendly fallback
        this.state.articles = this.sampleArticles.slice();
        this.state.totalResults = this.sampleArticles.length;
        this.renderNews(this.state.articles);
    }

    resetState(update) {
        this.state = {
            ...this.state,
            ...update,
            page: 1,
            articles: [],
            totalResults: Infinity,
            loading: false
        };
        document.getElementById("newsGrid").innerHTML = "";
        this.hideEndMessage();
        this.hideError();
    }

    async loadMore() {
        if (this.state.loading) return;
        if (this.state.articles.length >= this.state.totalResults) {
            this.showEndMessage();
            return;
        }

        this.state.page++;
        this.toggleLoading(true);

        try {
            const url = this.buildUrl();
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.status === "ok" && data.articles && data.articles.length > 0) {
                this.state.articles.push(...data.articles);
                this.renderNews(data.articles, true);
                if (this.state.articles.length >= (data.totalResults || this.state.totalResults)) {
                    this.showEndMessage();
                }
            } else {
                // no more results - show end message
                this.showEndMessage();
            }
        } catch (error) {
            console.warn("Load more failed:", error);
            // restore page on failure
            this.state.page = Math.max(1, this.state.page - 1);
        } finally {
            this.toggleLoading(false);
        }
    }

    buildUrl() {
        const params = new URLSearchParams({
            apiKey: this.API_KEY,
            page: this.state.page,
            pageSize: 20
        });

        if (this.state.query) {
            // for search we use /everything and remove country/category params
            params.append("q", this.state.query);
            return `${this.BASE_URL}/everything?${params.toString()}`;
        } else {
            // top-headlines requires either country or sources; we use country & category
            params.append("country", "us");
            params.append("category", this.state.category);
            return `${this.BASE_URL}/top-headlines?${params.toString()}`;
        }
    }

    renderNews(articles, append = false) {
        const grid = document.getElementById("newsGrid");
        if (!append) grid.innerHTML = "";

        articles.forEach((article) => {
            const card = document.createElement("article");
            card.className = "news-card";
            card.setAttribute("role", "article");
            card.dataset.url = article.url || "#";

            const imgHtml = article.urlToImage
                ? `<img src="${article.urlToImage}" alt="${this.escapeHtml(article.title || 'news')}" class="news-image" onerror="this.style.display='none'">`
                : `<div class="default-image">NEWS</div>`;

            const title = this.escapeHtml(article.title || 'Untitled');
            const desc = this.escapeHtml(article.description || 'No description available.');
            const source = this.escapeHtml((article.source && article.source.name) || "Unknown");
            const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

            card.innerHTML = `
                ${imgHtml}
                <div class="news-content">
                    <h3 class="news-title">${title}</h3>
                    <p class="news-description">${desc}</p>
                    <div class="news-meta">
                        <span class="news-source">${source}</span>
                        <span class="news-date">${date}</span>
                    </div>
                </div>`;

            grid.appendChild(card);
        });
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    showError(msg) {
        const el = document.getElementById("error");
        el.textContent = msg;
        el.hidden = false;
    }

    hideError() {
        document.getElementById("error").hidden = true;
    }

    showEndMessage() {
        document.getElementById("endMessage").hidden = false;
    }

    hideEndMessage() {
        document.getElementById("endMessage").hidden = true;
    }

    toggleLoading(show) {
        this.state.loading = !!show;
        const el = document.getElementById("loading");
        el.hidden = !show;
    }
}

document.addEventListener("DOMContentLoaded", () => new NewsApp());
