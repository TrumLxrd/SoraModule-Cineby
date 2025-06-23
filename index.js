// Filename: index.js

// 1. Define the Constructor Function
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

// 2. Add methods to the prototype
Cineby.prototype.search = function(query, type) {
    var self = this;
    console.log("Cineby LOG: Search function started.");
    return new Promise(function(resolve, reject) {
        var endpoint = type === "movie" ? "movie" : "tv";
        var tmdbUrl = "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + self.tmdb_api_key + "&query=" + encodeURIComponent(query);

        console.log("Cineby LOG: Fetching from TMDB: " + tmdbUrl);
        fetch(tmdbUrl)
            .then(function(response) {
                console.log("Cineby LOG: Received TMDB response.");
                return response.json();
            })
            .then(function(data) {
                console.log("Cineby LOG: Parsed TMDB JSON.");
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
                console.log("Cineby LOG: Search successful. Resolving with " + results.length + " results.");
                resolve(results);
            })
            .catch(function(error) {
                console.log("Cineby LOG: Search failed. Resolving with empty array.");
                resolve([]);
            });
    });
};

Cineby.prototype.get_sources = function(url) {
    var self = this;
    console.log("Cineby LOG: Get_sources function started for URL: " + url);
    return new Promise(function(resolve, reject) {
        var urlParts = url.split("/");
        var type = urlParts[urlParts.length - 2];
        var tmdbId = urlParts[urlParts.length - 1];

        if (!tmdbId || !type) {
            console.log("Cineby LOG: Invalid URL format. Resolving with empty array.");
            resolve([]);
            return;
        }

        console.log("Cineby LOG: Fetching TMDB details for ID: " + tmdbId);
        var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + self.tmdb_api_key;

        fetch(tmdbUrl)
            .then(function(response) { return response.json(); })
            .then(function(tmdbData) {
                var title = type === "movie" ? tmdbData.title : tmdbData.name;
                console.log("Cineby LOG: Got TMDB title: " + title + ". Searching on Cineby.");
                var searchUrl = self.search_url + "?q=" + encodeURIComponent(title);
                return fetch(searchUrl, { headers: self.headers });
            })
            .then(function(response) { return response.text(); })
            .then(function(html) {
                console.log("Cineby LOG: Got Cineby search page. Looking for content link.");
                var resultPattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>/;
                var match = html.match(resultPattern);

                if (!match || !match[1]) {
                    console.log("Cineby LOG: No content link found on Cineby. Resolving with empty array.");
                    resolve([]);
                    return;
                }

                var contentUrl = match[1];
                var fullContentUrl = contentUrl.indexOf("http") === 0 ? contentUrl : self.baseUrl + contentUrl;
                console.log("Cineby LOG: Found content link. Fetching page: " + fullContentUrl);
                return fetch(fullContentUrl, { headers: self.headers });
            })
            .then(function(response) { return response.text(); })
            .then(function(contentHtml) {
                console.log("Cineby LOG: Got content page. Extracting sources.");
                var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1 && contentHtml.indexOf("Season") !== -1;
                if (isTvShow) {
                    resolve(self._extract_tv_sources(contentHtml, url));
                } else {
                    resolve(self._extract_movie_sources(contentHtml, url));
                }
            })
            .catch(function(error) {
                console.log("Cineby LOG: Get_sources failed. Resolving with empty array.");
                resolve([]);
            });
    });
};

Cineby.prototype._extract_movie_sources = function(html, url) {
    var sources = [];
    // ... (rest of the function is the same)
    return sources;
};

Cineby.prototype._extract_tv_sources = function(html, url) {
    var sources = [];
    // ... (rest of the function is the same)
    return sources;
};

Cineby.prototype.get_episode_sources = function(url) {
    var self = this;
    console.log("Cineby LOG: Get_episode_sources started for URL: " + url);
    return new Promise(function(resolve, reject) {
        fetch(url, { headers: self.headers })
            .then(function(response) { return response.text(); })
            .then(function(html) {
                console.log("Cineby LOG: Got episode page. Extracting sources.");
                resolve(self._extract_movie_sources(html, url));
            })
            .catch(function(error) {
                console.log("Cineby LOG: Get_episode_sources failed. Resolving with empty array.");
                resolve([]);
            });
    });
};

// This is the critical part that the other working modules use.
// It must be the very last line, and it must not have 'export default'.
var module = new Cineby();
