class cineby {
    constructor() {
        this.name = "Cineby";
        this.baseUrl = "https://www.cineby.app";
        this.search_url = `${this.baseUrl}/search/`;
        this.tmdb_api_key = "d9956abacedb5b43a16cc4864b26d451";
        this.tmdb_image_base = "https://image.tmdb.org/t/p/w500";
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        };
    }

    async search(query, type) {
        console.log(`Searching for ${query}, type: ${type}`);
        try {
            // Define the TMDB endpoint based on content type
            let endpoint = type === "movie" ? "movie" : "tv";
            
            // Make request to TMDB
            const response = await fetch(
                `https://api.themoviedb.org/3/search/${endpoint}?api_key=${this.tmdb_api_key}&query=${encodeURIComponent(query)}`
            );
            
            if (!response.ok) {
                throw new Error(`TMDB search failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`TMDB found ${data.results?.length || 0} results`);
            
            // Map TMDB results to our format
            const results = [];
            for (const item of data.results || []) {
                // Get basic info from TMDB
                const title = type === "movie" ? item.title : item.name;
                const year = item.release_date 
                    ? item.release_date.split("-")[0] 
                    : (item.first_air_date ? item.first_air_date.split("-")[0] : "");
                const poster = item.poster_path 
                    ? `${this.tmdb_image_base}${item.poster_path}` 
                    : "";
                
                // Build our result object - store TMDB data for later use
                results.push({
                    title: title,
                    year: year,
                    img: poster,
                    tmdbId: item.id,
                    url: `${this.baseUrl}/${type}/${item.id}`, // We'll use this format for simplicity
                    type: type
                });
            }
            
            console.log(`Returning ${results.length} search results`);
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
            const match = url.match(/\/([^\/]+)\/(\d+)$/);
            if (!match) {
                throw new Error("Invalid URL format");
            }
            
            const type = match[1];
            const tmdbId = match[2];
            console.log(`Extracted type: ${type}, tmdbId: ${tmdbId}`);
            
            // Use TMDB ID to get details
            const tmdbResponse = await fetch(
                `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${this.tmdb_api_key}`
            );
            
            if (!tmdbResponse.ok) {
                throw new Error(`TMDB details failed: ${tmdbResponse.status}`);
            }
            
            const tmdbData = await tmdbResponse.json();
            
            // Get title based on content type
            const title = type === "movie" ? tmdbData.title : tmdbData.name;
            console.log(`Looking for content: ${title}`);
            
            // Search on Cineby for this title
            const searchUrl = `${this.search_url}?q=${encodeURIComponent(title)}`;
            const searchResponse = await fetch(searchUrl, { headers: this.headers });
            
            if (!searchResponse.ok) {
                throw new Error(`Cineby search failed: ${searchResponse.status}`);
            }
            
            const html = await searchResponse.text();
            
            // Find the first matching result
            const resultPattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>.*?<div[^>]*class="[^"]*text-sm[^"]*font-semibold[^"]*"[^>]*>(.*?)<\/div>/gs;
            
            let match2, contentUrl;
            while ((match2 = resultPattern.exec(html)) !== null) {
                const resultTitle = match2[2].replace(/<.*?>/g, '').trim();
                
                // Simple title matching - you could make this more sophisticated
                if (resultTitle.toLowerCase().includes(title.toLowerCase())) {
                    contentUrl = match2[1];
                    break;
                }
            }
            
            if (!contentUrl) {
                console.error("No matching content found on Cineby");
                return [];
            }
            
            // Get the full URL to the content
            const fullContentUrl = contentUrl.startsWith('http') ? contentUrl : this.baseUrl + contentUrl;
            console.log("Found content URL:", fullContentUrl);
            
            // Get the content page
            const contentResponse = await fetch(fullContentUrl, { headers: this.headers });
            
            if (!contentResponse.ok) {
                throw new Error(`Content page fetch failed: ${contentResponse.status}`);
            }
            
            const contentHtml = await contentResponse.text();
            
            // Determine if it's a movie or show
            const isTvShow = /<div\s+role="tablist".*?>.*?Season/is.test(contentHtml);
            
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
        const sources = [];
        
        // Find iframe players
        const iframePattern = /<iframe.*?src="([^"]+)"/g;
        let match;
        
        while ((match = iframePattern.exec(html)) !== null) {
            let iframe_src = match[1];
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
        const videoPattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
        let i = 1;
        
        while ((match = videoPattern.exec(html)) !== null) {
            console.log("Found direct source:", match[1]);
            sources.push({
                url: match[1],
                title: `Source ${i++}`,
                type: 'direct'
            });
        }
        
        return sources;
    }
    
    _extract_tv_sources(html, url) {
        const sources = [];
        
        try {
            // Find active season
            const seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
            const season = seasonMatch ? seasonMatch[1] : "1";
            
            // Find episodes
            const episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/gs;
            let match;
            
            while ((match = episodePattern.exec(html)) !== null) {
                const episodeUrl = match[1];
                const episodeNum = match[2];
                
                const fullUrl = episodeUrl.startsWith('http') ? episodeUrl : this.baseUrl + episodeUrl;
                sources.push({
                    url: fullUrl,
                    title: `Season ${season} Episode ${episodeNum}`,
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
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const html = await response.text();
            return this._extract_movie_sources(html, url);
            
        } catch (error) {
            console.error("Error getting episode sources:", error);
            return [];
        }
    }
}

// Define the module for Sora to import
const module = new cineby();
export default module;
