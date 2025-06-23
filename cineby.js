// Filename: cineby.js

function Cineby() {
    this.name = "Cineby";
    this.baseUrl = "https://www.cineby.app";
    this.tmdbKey = "d9956abacedb5b43a16cc4864b26d451";
    // Using TMDB multi-search, just like the net3lix module
    this.searchUrl = "https://api.themoviedb.org/3/search/multi?api_key=" + this.tmdbKey + "&language=en-US&include_adult=true&query=";
    this.imageBase = "https://image.tmdb.org/t/p/w500";
    this.cinebySearchPath = this.baseUrl + "/search/?q=";
    this.headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    };
}

/**
 * Search for movies or TV shows using TMDB.
 * Returns a Promise that resolves with an array of search results.
 */
Cineby.prototype.search = function(query, type) {
    var self = this;
    // This returns the fetch promise chain directly, which is what Sora expects.
    return fetch(self.searchUrl + encodeURIComponent(query))
        .then(function(res) {
            return res.json();
        })
        .then(function(json) {
            var results = [];
            // Use forEach loop, similar to the example
            (json.results || []).forEach(function(item) {
                // Filter results to only match the requested type (movie or tv)
                if ((type === "movie" && item.media_type !== "movie") || (type === "tv" && item.media_type !== "tv")) {
                    return; // Skip if it's not the right type
                }
                var title = item.media_type === "movie" ? item.title : item.name;
                var date = item.release_date || item.first_air_date || "";
                var year = date.split("-")[0] || "";
                var img = item.poster_path ? self.imageBase + item.poster_path : "";
                
                // Create a synthetic URL to pass the TMDB ID and type to get_sources
                var syntheticUrl = self.baseUrl + "/" + item.media_type + "/" + item.id;

                results.push({
                    title: title,
                    url: syntheticUrl,
                    img: img,
                    year: year
                });
            });
            return results;
        })
        .catch(function(err) {
            // ALWAYS resolve with an array, even on error, to prevent hanging.
            console.error("Cineby Search Error:", err);
            return [];
        });
};

/**
 * Get sources for a movie or a list of episodes for a TV show.
 * The 'url' parameter is the synthetic URL created in the search function.
 */
Cineby.prototype.get_sources = function(url) {
    var self = this;
    return new Promise(function(resolve) {
        // 1. Parse the synthetic URL to get TMDB type and ID
        var match = url.match(/\/(movie|tv)\/(\d+)/);
        if (!match) {
            return resolve([]);
        }
        var type = match[1];
        var tmdbId = match[2];

        // 2. Fetch TMDB details to get the official title
        var detailsUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + self.tmdbKey;
        fetch(detailsUrl)
            .then(function(res) {
                return res.json();
            })
            .then(function(details) {
                var title = (type === "movie" ? details.title : details.name) || "";
                // 3. Search for the title on cineby.app
                return fetch(self.cinebySearchPath + encodeURIComponent(title), { headers: self.headers });
            })
            .then(function(res) {
                return res.text();
            })
            .then(function(html) {
                // 4. Find the first search result link on the Cineby page
                var linkMatch = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col/);
                if (!linkMatch) {
                    throw new Error("No content link found on Cineby");
                }
                var contentUrl = linkMatch[1];
                var fullContentUrl = contentUrl.startsWith("http") ? contentUrl : self.baseUrl + contentUrl;
                // 5. Fetch the actual content page
                return fetch(fullContentUrl, { headers: self.headers });
            })
            .then(function(res) {
                return res.text();
            })
            .then(function(contentHtml) {
                // 6. Check if it's a TV show page or a movie page
                var isTvShow = /role="tablist"/.test(contentHtml) && /Season/.test(contentHtml);
                if (isTvShow) {
                    // It's a TV show, so extract the episode list
                    resolve(self._extract_tv_sources(contentHtml));
                } else {
                    // It's a movie, so extract the video streams directly
                    resolve(self._extract_movie_sources(contentHtml));
                }
            })
            .catch(function(err) {
                console.error("Cineby Get Sources Error:", err);
                resolve([]);
            });
    });
};

/**
 * Gets the actual video streams for a single episode page.
 */
Cineby.prototype.get_episode_sources = function(url) {
    var self = this;
    return new Promise(function(resolve) {
        fetch(url, { headers: self.headers })
            .then(function(res) { return res.text(); })
            .then(function(html) {
                // An episode page is structured like a movie page, so we can reuse the same extractor
                resolve(self._extract_movie_sources(html));
            })
            .catch(function(err) {
                console.error("Cineby Get Episode Sources Error:", err);
                resolve([]);
            });
    });
};

// --- Internal Helper Functions ---

Cineby.prototype._extract_movie_sources = function(html) {
    var sources = [];
    var self = this;
    // Find iframe players
    var iframeRe = /<iframe.*?src="([^"]+)"/g;
    var match;
    while ((match = iframeRe.exec(html)) !== null) {
        var src = match[1];
        if (!src.startsWith("http")) {
            src = src.startsWith("//") ? "https:" + src : self.baseUrl + src;
        }
        sources.push({ url: src, type: "iframe", title: "Default Player" });
    }
    // Find direct file URLs from scripts
    var fileRe = /file:\s*"([^"]+)"/g;
    var count = 1;
    while ((match = fileRe.exec(html)) !== null) {
        sources.push({ url: match[1], type: "direct", title: "Source " + (count++) });
    }
    return sources;
};

Cineby.prototype._extract_tv_sources = function(html) {
    var sources = [];
    var self = this;
    // Find the active season number
    var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
    var season = seasonMatch ? seasonMatch[1] : "1";
    // Find all episode links for that season
    var epRe = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
    var match;
    while ((match = epRe.exec(html)) !== null) {
        var epUrl = match[1];
        var epNum = match[2];
        var fullUrl = epUrl.startsWith("http") ? epUrl : self.baseUrl + epUrl;
        sources.push({
            url: fullUrl,
            title: "Season " + season + " Episode " + epNum,
            type: "episode"
        });
    }
    return sources;
};


// Finally, instantiate the module so Sora can use it.
// This must be the last line, with no 'export'.
var module = new Cineby();
