class cineby {
    constructor() {
        this.name = "Cineby";
        this.baseUrl = "https://www.cineby.app";
        this.search_url = this.baseUrl + "/search/";
        this.tmdb_api_key = "d9956abacedb5b43a16cc4864b26d451";
        this.tmdb_image_base = "https://image.tmdb.org/t/p/w500";
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        };
    }

    async search(query, type) {
        console.log("Searching for " + query + ", type: " + type);
        try {
            // Define the TMDB endpoint based on content type
            var endpoint = type === "movie" ? "movie" : "tv";
            
            // Make request to TMDB
            var response = await fetch(
                "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + this.tmdb_api_key + "&query=" + encodeURIComponent(query)
            );
            
            if (!response.ok) {
                throw new Error("TMDB search failed: " + response.status);
            }
            
            var data = await response.json();
            console.log("TMDB found " + (data.results ? data.results.length : 0) + " results");
            
            // Map TMDB results to our format
            var results = [];
            if (data.results && data.results.length > 0) {
                for (var i = 0; i < data.results.length; i++) {
                    var item = data.results[i];
                    // Get basic info from TMDB
                    var title = type === "movie" ? item.title : item.name;
                    var year = "";
                    if (item.release_date) {
                        year = item.release_date.split("-")[0];
                    } else if (item.first_air_date) {
                        year = item.first_air_date.split("-")[0];
                    }
                    
                    var poster = "";
                    if (item.poster_path) {
                        poster = this.tmdb_image_base + item.poster_path;
                    }
                    
                    // Build our result object - store TMDB data for later use
                    results.push({
                        title: title,
                        year: year,
                        img: poster,
                        tmdbId: item.id,
                        url: this.baseUrl + "/" + type + "/" + item.id, // We'll use this format for simplicity
                        type: type
                    });
                }
            }
            
            console.log("Returning " + results.length + " search results");
            return results;
            
        } catch (error) {
            console.error("Search error:", error);
            return [];
        }
    }
    
    async get_sources(url) {
        console.log("Getting sources for:", url);
        try {
            // Extract TMDB ID from URL
            var match = url.match(/\/([^\/]+)\/(\d+)$/);
            if (!match) {
                throw new Error("Invalid URL format");
            }
            
            var type = match[1];
            var tmdbId = match[2];
            console.log("Extracted type: " + type + ", tmdbId: " + tmdbId);
            
            // Use TMDB ID to get details
            var tmdbResponse = await fetch(
                "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + this.tmdb_api_key
            );
            
            if (!tmdbResponse.ok) {
                throw new Error("TMDB details failed: " + tmdbResponse.status);
            }
            
            var tmdbData = await tmdbResponse.json();
            
            // Get title based on content type
            var title = type === "movie" ? tmdbData.title : tmdbData.name;
            console.log("Looking for content: " + title);
            
            // Search on Cineby for this title
            var searchUrl = this.search_url + "?q=" + encodeURIComponent(title);
            var searchResponse = await fetch(searchUrl, { headers: this.headers });
            
            if (!searchResponse.ok) {
                throw new Error("Cineby search failed: " + searchResponse.status);
            }
            
            var html = await searchResponse.text();
            
            // Find the first matching result
            var resultPattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>.*?<div[^>]*class="[^"]*text-sm[^"]*font-semibold[^"]*"[^>]*>(.*?)<\/div>/gs;
            
            var match2, contentUrl;
            while ((match2 = resultPattern.exec(html)) !== null) {
                var resultTitle = match2[2].replace(/<.*?>/g, '').trim();
                
                // Simple title matching - you could make this more sophisticated
                if (resultTitle.toLowerCase().indexOf(title.toLowerCase()) !== -1) {
                    contentUrl = match2[1];
                    break;
                }
            }
            
            if (!contentUrl) {
                console.error("No matching content found on Cineby");
                return [];
            }
            
            // Get the full URL to the content
            var fullContentUrl = contentUrl.startsWith('http') ? contentUrl : this.baseUrl + contentUrl;
            console.log("Found content URL:", fullContentUrl);
            
            // Get the content page
            var contentResponse = await fetch(fullContentUrl, { headers: this.headers });
            
            if (!contentResponse.ok) {
                throw new Error("Content page fetch failed: " + contentResponse.status);
            }
            
            var contentHtml = await contentResponse.text();
            
            // Determine if it's a movie or show
            var isTvShow = /<div\s+role="tablist".*?>.*?Season/is.test(contentHtml);
            
            if (isTvShow) {
                console.log("Detected TV show");
                return this._extract_tv_sources(contentHtml, fullContentUrl);
            } else {
                console.log("Detected movie");
                return this._extract_movie_sources(contentHtml, fullContentUrl);
            }
            
        } catch (error) {
            console.error("Error getting sources:", error);
            return [];
        }
    }
    
    _extract_movie_sources(html, url) {
        var sources = [];
        
        // Find iframe players
        var iframePattern = /<iframe.*?src="([^"]+)"/g;
        var match;
        
        while ((match = iframePattern.exec(html)) !== null) {
            var iframe_src = match[1];
            if (!iframe_src.startsWith('http')) {
                iframe_src = iframe_src.startsWith('//') ? 'https:' + iframe_src : this.baseUrl + iframe_src;
            }
            
            console.log("Found iframe source:", iframe_src);
            sources.push({
                url: iframe_src,
                title: 'Player Source',
                type: 'iframe'
            });
        }
        
        // Find direct video sources
        var videoPattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
        var i = 1;
        
        while ((match = videoPattern.exec(html)) !== null) {
            console.log("Found direct source:", match[1]);
            sources.push({
                url: match[1],
                title: "Source " + i++,
                type: 'direct'
            });
        }
        
        return sources;
    }
    
    _extract_tv_sources(html, url) {
        var sources = [];
        
        try {
            // Find active season
            var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
            var season = seasonMatch ? seasonMatch[1] : "1";
            
            // Find episodes
            var episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/gs;
            var match;
            
            while ((match = episodePattern.exec(html)) !== null) {
                var episodeUrl = match[1];
                var episodeNum = match[2];
                
                var fullUrl = episodeUrl.startsWith('http') ? episodeUrl : this.baseUrl + episodeUrl;
                sources.push({
                    url: fullUrl,
                    title: "Season " + season + " Episode " + episodeNum,
                    type: 'episode'
                });
            }
            
            return sources;
            
        } catch (error) {
            console.error("Error extracting TV sources:", error);
            return [];
        }
    }
    
    async get_episode_sources(url) {
        try {
            var response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                throw new Error("HTTP error: " + response.status);
            }
            
            var html = await response.text();
            return this._extract_movie_sources(html, url);
            
        } catch (error) {
            console.error("Error getting episode sources:", error);
            return [];
        }
    }
}

// Define the module for Sora to import
var module = new cineby();
export default module;
