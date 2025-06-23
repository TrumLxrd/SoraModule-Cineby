// Filename: cineby.js

// --- Configuration ---
var CINEBY_CONFIG = {
    name: "Cineby",
    baseUrl: "https://www.cineby.app",
    tmdbKey: "d9956abacedb5b43a16cc4864b26d451",
    searchUrl: "https://api.themoviedb.org/3/search/multi",
    detailsUrl: "https://api.themoviedb.org/3",
    imageBase: "https://image.tmdb.org/t/p/w500",
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
};

// --- Helper Functions ---

/**
 * Extracts iframe and direct file sources from HTML content.
 * @param {string} html The HTML content of the page.
 * @returns {Array} An array of source objects.
 */
function _extractSources(html) {
    var sources = [];
    var iframeRe = /<iframe.*?src="([^"]+)"/g;
    var fileRe = /file:\s*"([^"]+)"/g;
    var match;

    // Extract iframe sources
    while ((match = iframeRe.exec(html)) !== null) {
        var src = match[1];
        if (!src.startsWith("http")) {
            src = src.startsWith("//") ? "https:" + src : CINEBY_CONFIG.baseUrl + src;
        }
        sources.push({ url: src, type: "iframe", title: "Iframe Player" });
    }

    // Extract direct file URLs
    var count = 1;
    while ((match = fileRe.exec(html)) !== null) {
        sources.push({ url: match[1], type: "direct", title: "Direct Source " + (count++) });
    }
    return sources;
}

/**
 * Extracts episode links from a TV show's page content.
 * @param {string} html The HTML content of the page.
 * @returns {Array} An array of episode objects.
 */
function _extractTvEpisodes(html) {
    var sources = [];
    var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
    var season = seasonMatch ? seasonMatch[1] : "1";
    var epRe = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
    var match;
    while ((match = epRe.exec(html)) !== null) {
        var epUrl = match[1];
        var epNum = match[2];
        var fullUrl = epUrl.startsWith("http") ? epUrl : CINEBY_CONFIG.baseUrl + epUrl;
        sources.push({
            url: fullUrl,
            title: "Season " + season + " Episode " + epNum,
            type: "episode"
        });
    }
    return sources;
}


// --- Main Module Functions ---

/**
 * Search for movies or TV shows using the TMDB API.
 * @param {string} query The search query.
 * @param {string} type The content type ('movie' or 'tv').
 * @returns {Promise<Array>} A promise that resolves to an array of search results.
 */
async function search(query, type) {
    try {
        console.log("CINEBY_LOG: search called with query:", query, "type:", type);
        var searchUrl = CINEBY_CONFIG.searchUrl + "?api_key=" + CINEBY_CONFIG.tmdbKey + "&query=" + encodeURIComponent(query);
        var response = await fetch(searchUrl);
        var json = await response.json();
        
        var results = [];
        if (json.results) {
            for (var i = 0; i < json.results.length; i++) {
                var item = json.results[i];
                if (item.media_type === type) {
                    var title = type === "movie" ? item.title : item.name;
                    var date = item.release_date || item.first_air_date || "";
                    var year = date.split("-")[0] || "";
                    var img = item.poster_path ? CINEBY_CONFIG.imageBase + item.poster_path : "";
                    var syntheticUrl = CINEBY_CONFIG.baseUrl + "/" + item.media_type + "/" + item.id;
                    
                    results.push({
                        title: title,
                        url: syntheticUrl,
                        img: img,
                        year: year
                    });
                }
            }
        }
        console.log("CINEBY_LOG: search finished, found results:", results.length);
        return results;
    } catch (err) {
        console.error("CINEBY_LOG: Search Error ->", err);
        return []; // IMPORTANT: Always return an array, even on failure.
    }
}

/**
 * Get sources for a movie or a list of episodes for a TV show.
 * @param {string} url The synthetic URL from the search results.
 * @returns {Promise<Array>} A promise that resolves to an array of sources or episodes.
 */
async function get_sources(url) {
    try {
        console.log("CINEBY_LOG: get_sources called with url:", url);
        var match = url.match(/\/(movie|tv)\/(\d+)/);
        if (!match) return [];

        var type = match[1];
        var tmdbId = match[2];

        // 1. Get official title from TMDB
        var detailsUrl = CINEBY_CONFIG.detailsUrl + "/" + type + "/" + tmdbId + "?api_key=" + CINEBY_CONFIG.tmdbKey;
        var detailsRes = await fetch(detailsUrl);
        var detailsJson = await detailsRes.json();
        var title = (type === "movie" ? detailsJson.title : detailsJson.name) || "";

        // 2. Search Cineby with the official title
        var cinebySearchUrl = CINEBY_CONFIG.baseUrl + "/search/?q=" + encodeURIComponent(title);
        var cinebySearchRes = await fetch(cinebySearchUrl, { headers: CINEBY_CONFIG.headers });
        var cinebyHtml = await cinebySearchRes.text();

        // 3. Find the first result link on Cineby
        var linkMatch = cinebyHtml.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col/);
        if (!linkMatch) return [];
        var contentUrl = linkMatch[1];
        var fullContentUrl = contentUrl.startsWith("http") ? contentUrl : CINEBY_CONFIG.baseUrl + contentUrl;
        
        // 4. Fetch the content page
        var contentRes = await fetch(fullContentUrl, { headers: CINEBY_CONFIG.headers });
        var contentHtml = await contentRes.text();

        // 5. Determine if movie or TV and extract accordingly
        if (type === "tv") {
            return _extractTvEpisodes(contentHtml);
        } else {
            return _extractSources(contentHtml);
        }
    } catch (err) {
        console.error("CINEBY_LOG: Get Sources Error ->", err);
        return []; // IMPORTANT: Always return an array.
    }
}

/**
 * Gets the actual video streams for a single episode page.
 * @param {string} url The URL of the episode page.
 * @returns {Promise<Array>} A promise that resolves to an array of video sources.
 */
async function get_episode_sources(url) {
    try {
        console.log("CINEBY_LOG: get_episode_sources called with url:", url);
        var response = await fetch(url, { headers: CINEBY_CONFIG.headers });
        var html = await response.text();
        return _extractSources(html);
    } catch (err) {
        console.error("CINEBY_LOG: Get Episode Sources Error ->", err);
        return []; // IMPORTANT: Always return an array.
    }
}


// --- Create the module object for Sora ---
// This is the only part that should be exposed globally.
// There is no `export` statement.
var module = {
    search: search,
    get_sources: get_sources,
    get_episode_sources: get_episode_sources
};
