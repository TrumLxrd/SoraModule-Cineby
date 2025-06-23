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
            
            const results = [];
            
            // Regex pattern to extract search results
            const search_pattern = /<a[^>]+href="([^"]+)"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>.*?<div[^>]*class="[^"]*text-sm[^"]*font-semibold[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*text-xs[^"]*uppercase[^"]*"[^>]*>(.*?)<\/div>/gs;
            
            let match;
            while ((match = search_pattern.exec(html)) !== null) {
                const item_url = match[1];
                const img_url = match[2];
                const title = match[3].replace(/<.*?>/g, '').trim();
                const item_type = match[4].replace(/<.*?>/g, '').trim().toLowerCase();
                
                console.log("Found item:", title, item_type);
                
                // Type checking using regex
                const isMovie = type_ === 'movie' && 
                    (/film|movie/i.test(item_type) || 
                    !/serie|série|show/i.test(item_type));
                    
                const isTv = type_ === 'tv' && 
                    (/série|serie|show|tv/i.test(item_type));
                    
                if (isMovie || isTv) {
                    const year_match = /\((\d{4})\)/.exec(title);
                    const year = year_match ? year_match[1] : "";
                    
                    let clean_title = title;
                    if (year) {
                        clean_title = title.replace(`(${year})`, "").trim();
                    }
                    
                    results.push({
                        'title': clean_title,
                        'url': /^https?:\/\//.test(item_url) ? item_url : this.baseUrl + item_url,
                        'img': /^https?:\/\//.test(img_url) ? img_url : (/^\//.test(img_url) ? this.baseUrl + img_url : this.baseUrl + '/' + img_url),
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
            
            // Check if this is a TV show using regex
            const seasons_check = /<div\s+role="tablist".*?>.*?Season/is.test(html);
            
            if (seasons_check) {
                console.log("Detected TV show content");
                return this._extract_tv_sources(html, url);
            } else {
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
