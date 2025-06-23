class cineby {
    constructor() {
        this.name = "Cineby";
        this.baseUrl = "https://www.cineby.app";
        this.search_url = `${this.baseUrl}/search/`;
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
        
        const search_query = encodeURIComponent(query);
        const search_url = `${this.search_url}?q=${search_query}`;
        
        try {
            const response = await fetch(search_url, { headers: this.headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            console.log("Search response received, length:", html.length);
            
            // Use regex to find all search result items
            const results = [];
            
            // More relaxed pattern that might catch more results
            const search_pattern = /<a[^>]+href="([^"]+)"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>.*?<div[^>]*class="[^"]*text-sm[^"]*font-semibold[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*text-xs[^"]*uppercase[^"]*"[^>]*>(.*?)<\/div>/gs;
            
            let match;
            while ((match = search_pattern.exec(html)) !== null) {
                const item_url = match[1];
                const img_url = match[2];
                const title = match[3].replace(/<.*?>/g, '').trim();
                const item_type = match[4].replace(/<.*?>/g, '').trim().toLowerCase();
                
                console.log("Found item:", title, item_type);
                
                // Less strict type checking
                const isMovie = type_ === 'movie' && 
                    (item_type.includes('film') || item_type.includes('movie') || 
                    !item_type.includes('serie') && !item_type.includes('série') && !item_type.includes('show'));
                    
                const isTv = type_ === 'tv' && 
                    (item_type.includes('série') || item_type.includes('serie') || 
                    item_type.includes('show') || item_type.includes('tv'));
                    
                if (isMovie || isTv) {
                    const year_match = title.match(/\((\d{4})\)/);
                    const year = year_match ? year_match[1] : "";
                    
                    let clean_title = title;
                    if (year) {
                        clean_title = title.replace(`(${year})`, "").trim();
                    }
                    
                    results.push({
                        'title': clean_title,
                        'url': item_url.startsWith('http') ? item_url : this.baseUrl + item_url,
                        'img': img_url.startsWith('http') ? img_url : (img_url.startsWith('/') ? this.baseUrl + img_url : this.baseUrl + '/' + img_url),
                        'year': year
                    });
                }
            }
            
            console.log("Search results:", results.length);
            return results;
            
        } catch (e) {
            console.error(`Error searching ${this.name}: ${e}`);
            return [];
        }
    }
    
    async get_sources(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            console.log("Get sources response received, length:", html.length);
            
            // Check if this is a TV show (has seasons) using regex
            const seasons_check = html.match(/<div\s+role="tablist".*?>.*?Season/is);
            
            if (seasons_check) {
                // TV Show
                console.log("Detected TV show content");
                return this._extract_tv_sources(html, url);
            } else {
                // Movie
                console.log("Detected movie content");
                return this._extract_movie_sources(html, url);
            }
                
        } catch (e) {
            console.error(`Error getting sources from ${this.name}: ${e}`);
            return [];
        }
    }
    
    _extract_movie_sources(html_content, url) {
        const sources = [];
        
        // Find the player iframe using regex
        const iframe_pattern = /<iframe.*?src="([^"]+)"/;
        const iframe_match = html_content.match(iframe_pattern);
        
        if (iframe_match) {
            let iframe_src = iframe_match[1];
            if (!iframe_src.startsWith('http')) {
                iframe_src = iframe_src.startsWith('//') ? 'https:' + iframe_src : this.baseUrl + iframe_src;
            }
            
            console.log("Found iframe source:", iframe_src);
            sources.push({
                'url': iframe_src,
                'title': 'Default Source',
                'type': 'iframe'
            });
        }
        
        // Find direct video sources from script tags
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
        
        // Additional pattern for video URLs
        const alt_pattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8))"/g;
        let alt_match;
        let j = 1;
        
        while ((alt_match = alt_pattern.exec(html_content)) !== null) {
            const video_url = alt_match[1];
            if (!sources.some(s => s.url === video_url)) {
                console.log("Found alternative source:", video_url);
                sources.push({
                    'url': video_url,
                    'title': `Alternative Source ${j++}`,
                    'type': 'direct'
                });
            }
        }
        
        // Look for any other video player elements
        const video_pattern = /<video[^>]*>\s*<source[^>]*src="([^"]+)"/g;
        let video_match;
        let k = 1;
        
        while ((video_match = video_pattern.exec(html_content)) !== null) {
            const video_url = video_match[1];
            if (!sources.some(s => s.url === video_url)) {
                console.log("Found video element source:", video_url);
                sources.push({
                    'url': video_url,
                    'title': `Video Source ${k++}`,
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
            
            // Find episodes for the active season
            const episode_pattern = /<a\s+href="([^"]+)"[^>]*class="block[^>]*>.*?<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>Episode\s+(\d+)[^<]*<\/span>/gs;
            let episode_match;
            
            while ((episode_match = episode_pattern.exec(html_content)) !== null) {
                const episode_url = episode_match[1];
                const episode_num = episode_match[2];
                console.log("Found episode:", episode_num, episode_url);
                
                const full_url = episode_url.startsWith('http') ? episode_url : this.baseUrl + episode_url;
                sources.push({
                    'url': full_url,
                    'title': `Season ${active_season} Episode ${episode_num}`,
                    'type': 'episode'
                });
            }
            
            // If no episodes found with the above pattern, try a more general one
            if (sources.length === 0) {
                console.log("No episodes found with primary pattern, trying alternative...");
                const alt_episode_pattern = /<a\s+href="([^"]+)"[^>]*>.*?Episode\s+(\d+).*?<\/a>/gs;
                
                while ((episode_match = alt_episode_pattern.exec(html_content)) !== null) {
                    const episode_url = episode_match[1];
                    const episode_num = episode_match[2];
                    console.log("Found episode (alt pattern):", episode_num, episode_url);
                    
                    const full_url = episode_url.startsWith('http') ? episode_url : this.baseUrl + episode_url;
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
