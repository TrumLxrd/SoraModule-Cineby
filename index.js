class cineby {
    constructor() {
        this.name = "Cineby";
        this.baseUrl = "https://www.cineby.app";
        this.search_url = `${this.baseUrl}/search/`;
        this.tmdb_api_key = "d9956abacedb5b43a16cc4864b26d451";
        this.tmdb_search_url = "https://api.themoviedb.org/3/search/";
        this.tmdb_image_base = "https://image.tmdb.org/t/p/w500";
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        };
        this.supported_types = ['movie', 'tv'];
    }

    async search(query, type_) {
        if (!this.supported_types.includes(type_)) {
            return [];
        }
        
        try {
            // Search TMDB for results
            console.log(`Searching TMDB for ${type_}: ${query}`);
            const tmdb_url = `${this.tmdb_search_url}${type_}?api_key=${this.tmdb_api_key}&query=${encodeURIComponent(query)}&include_adult=true`;
            
            const tmdb_response = await fetch(tmdb_url);
            if (!tmdb_response.ok) {
                throw new Error(`TMDB HTTP error! status: ${tmdb_response.status}`);
            }
            
            const tmdb_data = await tmdb_response.json();
            console.log(`TMDB returned ${tmdb_data.results.length} results`);
            
            if (!tmdb_data.results || tmdb_data.results.length === 0) {
                return [];
            }
            
            // Map TMDB results to our format
            const results = tmdb_data.results.slice(0, 15).map(item => {
                const title = type_ === 'movie' ? item.title : item.name;
                const year = item.release_date ? item.release_date.substring(0, 4) : 
                            (item.first_air_date ? item.first_air_date.substring(0, 4) : "");
                const poster = item.poster_path ? `${this.tmdb_image_base}${item.poster_path}` : "";
                
                // Create the search URL for cineby
                // We'll search for each item individually on cineby.app
                const cineby_search = `${this.search_url}?q=${encodeURIComponent(title)}`;
                
                return {
                    'title': title,
                    'url': cineby_search,
                    'img': poster,
                    'year': year,
                    'tmdb_id': item.id,
                    'tmdb_type': type_
                };
            });
            
            console.log(`Processed ${results.length} search results`);
            return results;
            
        } catch (e) {
            console.error(`Error searching ${this.name}: ${e}`);
            return [];
        }
    }
    
    async get_sources(url) {
        try {
            console.log("Getting sources for URL:", url);
            // First, we need to actually find the content on cineby
            // The URL we got from search is just a search URL, not a direct content URL
            
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            console.log("Search response received for content lookup, length:", html.length);
            
            // Extract the first search result URL
            const result_pattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>/;
            const result_match = html.match(result_pattern);
            
            if (!result_match) {
                console.error("No content match found on cineby.app");
                return [];
            }
            
            const content_url = result_match[1];
            const full_content_url = /^https?:\/\//.test(content_url) ? content_url : this.baseUrl + content_url;
            console.log("Found content URL:", full_content_url);
            
            // Now get the actual content page
            const content_response = await fetch(full_content_url, { headers: this.headers });
            if (!content_response.ok) {
                throw new Error(`HTTP error getting content! status: ${content_response.status}`);
            }
            
            const content_html = await content_response.text();
            console.log("Content page received, length:", content_html.length);
            
            // Check if this is a TV show using regex
            const seasons_check = /<div\s+role="tablist".*?>.*?Season/is.test(content_html);
            
            if (seasons_check) {
                console.log("Detected TV show content");
                return this._extract_tv_sources(content_html, full_content_url);
            } else {
                console.log("Detected movie content");
                return this._extract_movie_sources(content_html, full_content_url);
            }
                
        } catch (e) {
            console.error(`Error getting sources from ${this.name}: ${e}`);
            return [];
        }
    }
    
    _extract_movie_sources(html_content, url) {
        const sources = [];
        
        // Find iframe sources
        const iframe_pattern = /<iframe.*?src="([^"]+)"/g;
        let iframe_match;
        
        while ((iframe_match = iframe_pattern.exec(html_content)) !== null) {
            let iframe_src = iframe_match[1];
            if (!/^https?:\/\//.test(iframe_src)) {
                iframe_src = /^\/\//.test(iframe_src) ? 'https:' + iframe_src : this.baseUrl + iframe_src;
            }
            
            console.log("Found iframe source:", iframe_src);
            sources.push({
                'url': iframe_src,
                'title': 'Iframe Source',
                'type': 'iframe'
            });
        }
        
        // Find sources in script tags
        const sources_pattern = /sources:\s*\[\s*{\s*file:\s*"([^"]+)"/g;
        let sources_match;
        let i = 1;
        
        while ((sources_match = sources_pattern.exec(html_content)) !== null) {
            console.log("Found direct source:", sources_match[1]);
            sources.push({
                'url': sources_match[1],
                'title': `Source ${i++}`,
                'type': 'direct'
            });
        }
        
        // Find m3u8/mp4 URLs
        const video_url_pattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
        let video_url_match;
        let j = 1;
        
        while ((video_url_match = video_url_pattern.exec(html_content)) !== null) {
            const video_url = video_url_match[1];
            if (!sources.some(s => s.url === video_url)) {
                console.log("Found video URL:", video_url);
                sources.push({
                    'url': video_url,
                    'title': `Video ${j++}`,
                    'type': 'direct'
                });
            }
        }
        
        // Find source tags
        const source_tag_pattern = /<source[^>]*src="([^"]+)"[^>]*>/g;
        let source_tag_match;
        let k = 1;
        
        while ((source_tag_match = source_tag_pattern.exec(html_content)) !== null) {
            const video_url = source_tag_match[1];
            if (!sources.some(s => s.url === video_url)) {
                console.log("Found source tag:", video_url);
                sources.push({
                    'url': /^https?:\/\//.test(video_url) ? video_url : this.baseUrl + video_url,
                    'title': `Source Tag ${k++}`,
                    'type': 'direct'
                });
            }
        }
        
        console.log("Total movie sources found:", sources.length);
        return sources;
    }
    
    _extract_tv_sources(html_content, url) {
        const sources = [];
        
        try {
            // Find active season
            const active_season_pattern = /<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/;
            const active_season_match = html_content.match(active_season_pattern);
            const active_season = active_season_match ? active_season_match[1] : "1";
            console.log("Active season:", active_season);
            
            // Find episodes
            const episode_pattern = /<a\s+href="([^"]+)"[^>]*class="block[^>]*>.*?<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>Episode\s+(\d+)[^<]*<\/span>/gs;
            let episode_match;
            
            while ((episode_match = episode_pattern.exec(html_content)) !== null) {
                const episode_url = episode_match[1];
                const episode_num = episode_match[2];
                console.log("Found episode:", episode_num, episode_url);
                
                const full_url = /^https?:\/\//.test(episode_url) ? episode_url : this.baseUrl + episode_url;
                sources.push({
                    'url': full_url,
                    'title': `Season ${active_season} Episode ${episode_num}`,
                    'type': 'episode'
                });
            }
            
            // Alternative episode pattern
            if (sources.length === 0) {
                console.log("Trying alternative episode pattern...");
                const alt_episode_pattern = /<a\s+href="([^"]+)"[^>]*>.*?Episode\s+(\d+).*?<\/a>/gs;
                
                while ((episode_match = alt_episode_pattern.exec(html_content)) !== null) {
                    const episode_url = episode_match[1];
                    const episode_num = episode_match[2];
                    console.log("Found episode (alt):", episode_num, episode_url);
                    
                    const full_url = /^https?:\/\//.test(episode_url) ? episode_url : this.baseUrl + episode_url;
                    sources.push({
                        'url': full_url,
                        'title': `Season ${active_season} Episode ${episode_num}`,
                        'type': 'episode'
                    });
                }
            }
            
            console.log("Total TV episodes found:", sources.length);
            return sources;
        
        } catch (e) {
            console.error(`Error extracting TV sources: ${e}`);
            return [];
        }
    }
    
    async get_episode_sources(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            console.log("Get episode sources response received, length:", html.length);
            
            return this._extract_movie_sources(html, url);
            
        } catch (e) {
            console.error(`Error getting episode sources from ${this.name}: ${e}`);
            return [];
        }
    }
}

// Define the module for Sora to import
const module = new cineby();
export default module;
