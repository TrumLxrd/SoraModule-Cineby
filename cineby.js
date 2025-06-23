// Filename: cineby.js

function Cineby() {
    this.name = "Cineby";
    this.baseUrl = "https://www.cineby.app";
    this.search_url = "https://www.cineby.app/search/";
    this.tmdb_api_key = "d9956abacedb5b43a16cc4864b26d451";
    this.tmdb_image_base = "https://image.tmdb.org/t/p/w500";
    this.headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    };
}

Cineby.prototype.search = function(query, type) {
    var self = this;
    return new Promise(function(resolve, reject) {
        console.log("CINEBY_LOG: Search function called for '" + query + "'.");
        var endpoint = type === "movie" ? "movie" : "tv";
        var tmdbUrl = "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + self.tmdb_api_key + "&query=" + encodeURIComponent(query);

        fetch(tmdbUrl)
            .then(function(response) { return response.json(); })
            .then(function(data) {
                var results = [];
                if (data && data.results) {
                    for (var i = 0; i < data.results.length; i++) {
                        var item = data.results[i];
                        var title = type === "movie" ? item.title : item.name;
                        var year = "";
                        if (item.release_date) {
                            year = item.release_date.substring(0, 4);
                        } else if (item.first_air_date) {
                            year = item.first_air_date.substring(0, 4);
                        }
                        var poster = item.poster_path ? self.tmdb_image_base + item.poster_path : "";

                        results.push({
                            title: title,
                            year: year,
                            img: poster,
                            url: self.baseUrl + "/" + type + "/" + item.id,
                            type: type
                        });
                    }
                }
                console.log("CINEBY_LOG: Search finished. Found " + results.length + " results.");
                resolve(results);
            })
            .catch(function(error) {
                console.error("CINEBY_LOG: Search failed. Error: " + error);
                resolve([]);
            });
    });
};

Cineby.prototype.get_sources = function(url) {
    var self = this;
    return new Promise(function(resolve, reject) {
        console.log("CINEBY_LOG: Get sources called for '" + url + "'.");
        var urlParts = url.split("/");
        var type = urlParts[urlParts.length - 2];
        var tmdbId = urlParts[urlParts.length - 1];

        if (!tmdbId || !type) {
            resolve([]);
            return;
        }

        var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + self.tmdb_api_key;
        fetch(tmdbUrl)
            .then(function(response) { return response.json(); })
            .then(function(tmdbData) {
                var title = type === "movie" ? tmdbData.title : tmdbData.name;
                var searchUrl = self.search_url + "?q=" + encodeURIComponent(title);
                return fetch(searchUrl, { headers: self.headers });
            })
            .then(function(response) { return response.text(); })
            .then(function(html) {
                var resultPattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>/;
                var match = html.match(resultPattern);
                if (!match || !match[1]) { resolve([]); return; }
                var contentUrl = match[1];
                var fullContentUrl = contentUrl.indexOf("http") === 0 ? contentUrl : self.baseUrl + contentUrl;
                return fetch(fullContentUrl, { headers: self.headers });
            })
            .then(function(response) { return response.text(); })
            .then(function(contentHtml) {
                var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1 && contentHtml.indexOf("Season") !== -1;
                if (isTvShow) {
                    resolve(self._extract_tv_sources(contentHtml, url));
                } else {
                    resolve(self._extract_movie_sources(contentHtml, url));
                }
            })
            .catch(function(error) {
                console.error("CINEBY_LOG: Get sources failed. Error: " + error);
                resolve([]);
            });
    });
};

Cineby.prototype._extract_movie_sources = function(html, url) {
    var sources = [];
    var self = this;
    var iframePattern = /<iframe.*?src="([^"]+)"/g;
    var match;
    while ((match = iframePattern.exec(html)) !== null) {
        var src = match[1];
        if (src.indexOf("http") !== 0) { src = src.indexOf("//") === 0 ? 'https:' + src : self.baseUrl + src; }
        sources.push({ url: src, title: 'Player Source', type: 'iframe' });
    }
    var videoPattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
    var i = 1;
    while ((match = videoPattern.exec(html)) !== null) {
        sources.push({ url: match[1], title: "Source " + i++, type: 'direct' });
    }
    return sources;
};

Cineby.prototype._extract_tv_sources = function(html, url) {
    var sources = [];
    var self = this;
    var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
    var season = seasonMatch && seasonMatch[1] ? seasonMatch[1] : "1";
    var episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
    var match;
    while ((match = episodePattern.exec(html)) !== null) {
        var episodeUrl = match[1];
        var episodeNum = match[2];
        var fullUrl = episodeUrl.indexOf("http") === 0 ? episodeUrl : self.baseUrl + episodeUrl;
        sources.push({ url: fullUrl, title: "Season " + season + " Episode " + episodeNum, type: 'episode' });
    }
    return sources;
};

Cineby.prototype.get_episode_sources = function(url) {
    var self = this;
    return new Promise(function(resolve, reject) {
        fetch(url, { headers: self.headers })
            .then(function(response) { return response.text(); })
            .then(function(html) { resolve(self._extract_movie_sources(html, url)); })
            .catch(function(error) { resolve([]); });
    });
};

// The module must be instantiated and assigned to a 'module' variable.
var module = new Cineby();
