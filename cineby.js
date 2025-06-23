// Cineby.app Sora Module - Regex Only Version
// Version: 1.0.0

// Utility function to clean titles using regex
function cleanTitle(title) {
    if (!title) return '';
    return title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Utility function to convert relative URLs to absolute using regex
function makeAbsoluteUrl(url, baseUrl) {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    if (/^\/\//.test(url)) return 'https:' + url;
    if (/^\//.test(url)) return baseUrl + url;
    return baseUrl + '/' + url;
}

// Search for movies and TV shows using regex only
function searchResults(html) {
    const results = [];
    
    // Regex patterns for finding movie/show containers
    const containerPatterns = [
        /<div[^>]*class="[^"]*(?:movie|film|show|card|item)[^"]*"[^>]*>.*?<\/div>/gis,
        /<article[^>]*class="[^"]*(?:movie|film|show|card|item)[^"]*"[^>]*>.*?<\/article>/gis,
        /<li[^>]*class="[^"]*(?:movie|film|show|card|item)[^"]*"[^>]*>.*?<\/li>/gis,
        /<div[^>]*class="[^"]*(?:col|grid|flex)[^"]*"[^>]*>.*?<a[^>]*href="[^"]*"[^>]*>.*?<\/a>.*?<\/div>/gis
    ];
    
    for (const pattern of containerPatterns) {
        const matches = html.match(pattern) || [];
        
        for (const match of matches) {
            // Extract title using regex
            const titleRegex = /<(?:h[1-6]|div|span|p|a)[^>]*(?:class="[^"]*(?:title|name)[^"]*"|title="[^"]*")[^>]*>(.*?)<\/(?:h[1-6]|div|span|p|a)>/i;
            const titleMatch = match.match(titleRegex) || match.match(/<a[^>]*title="([^"]*)"[^>]*>/i) || match.match(/<img[^>]*alt="([^"]*)"[^>]*>/i);
            
            // Extract href using regex
            const hrefRegex = /<a[^>]*href="([^"]*)"[^>]*>/i;
            const hrefMatch = match.match(hrefRegex);
            
            // Extract image using regex
            const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/i;
            const imgMatch = match.match(imgRegex);
            
            if (titleMatch && hrefMatch) {
                const title = cleanTitle(titleMatch[1]);
                const href = makeAbsoluteUrl(hrefMatch[1], 'https://www.cineby.app');
                const image = imgMatch ? makeAbsoluteUrl(imgMatch[1], 'https://www.cineby.app') : '';
                
                if (title && href && !results.some(r => r.href === href)) {
                    results.push({ title, image, href });
                }
            }
        }
        
        if (results.length > 0) break;
    }
    
    // Fallback: Extract from JSON-LD using regex
    if (results.length === 0) {
        const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
        const jsonMatches = html.match(jsonLdRegex) || [];
        
        for (const jsonMatch of jsonMatches) {
            const jsonContent = jsonMatch.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
            
            // Extract movie/show data using regex
            const nameRegex = /"name"\s*:\s*"([^"]*)"/i;
            const urlRegex = /"url"\s*:\s*"([^"]*)"/i;
            const imageRegex = /"image"\s*:\s*"([^"]*)"/i;
            const typeRegex = /"@type"\s*:\s*"(Movie|TVSeries)"/i;
            
            const nameMatch = jsonContent.match(nameRegex);
            const urlMatch = jsonContent.match(urlRegex);
            const imageMatch = jsonContent.match(imageRegex);
            const typeMatch = jsonContent.match(typeRegex);
            
            if (nameMatch && urlMatch && typeMatch) {
                results.push({
                    title: cleanTitle(nameMatch[1]),
                    image: imageMatch ? makeAbsoluteUrl(imageMatch[1], 'https://www.cineby.app') : '',
                    href: makeAbsoluteUrl(urlMatch[1], 'https://www.cineby.app')
                });
            }
        }
    }
    
    return results;
}

// Extract details from movie/show page using regex only
function extractDetails(html) {
    const details = {};
    
    // Extract description using regex
    const descPatterns = [
        /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i,
        /<(?:div|p|span)[^>]*class="[^"]*(?:description|summary|plot|overview)[^"]*"[^>]*>(.*?)<\/(?:div|p|span)>/is,
        /<(?:div|p)[^>]*id="[^"]*(?:description|summary|plot)[^"]*"[^>]*>(.*?)<\/(?:div|p)>/is
    ];
    
    for (const pattern of descPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            details.description = cleanTitle(match[1]);
            break;
        }
    }
    
    // Extract alternative title using regex
    const altTitlePatterns = [
        /<(?:div|span|p)[^>]*class="[^"]*(?:alt-title|original-title|subtitle)[^"]*"[^>]*>(.*?)<\/(?:div|span|p)>/i,
        /<meta[^>]*property="og:title:alt"[^>]*content="([^"]*)"[^>]*>/i
    ];
    
    for (const pattern of altTitlePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            details.altTitle = cleanTitle(match[1]);
            break;
        }
    }
    
    // Extract year using regex
    const yearPatterns = [
        /<(?:div|span)[^>]*class="[^"]*(?:year|date|release)[^"]*"[^>]*>.*?(\d{4}).*?<\/(?:div|span)>/i,
        /<meta[^>]*property="video:release_date"[^>]*content="(\d{4})[^"]*"[^>]*>/i,
        /(?:year|release|date)[^>]*>.*?(\d{4})/i
    ];
    
    for (const pattern of yearPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            details.year = match[1];
            break;
        }
    }
    
    // Extract rating using regex
    const ratingRegex = /<(?:div|span)[^>]*class="[^"]*(?:rating|score)[^"]*"[^>]*>.*?(\d+(?:\.\d+)?).*?<\/(?:div|span)>/i;
    const ratingMatch = html.match(ratingRegex);
    if (ratingMatch) {
        details.rating = ratingMatch[1];
    }
    
    return details;
}

// Extract episode links for TV shows using regex only
function extractEpisodes(html) {
    const episodes = [];
    
    // Regex patterns for episode links
    const episodePatterns = [
        /<a[^>]*href="([^"]*)"[^>]*>.*?(?:episode|ep)[\s\-]*(\d+).*?<\/a>/gi,
        /<(?:div|li)[^>]*class="[^"]*episode[^"]*"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>.*?(\d+).*?<\/a>.*?<\/(?:div|li)>/gi,
        /<a[^>]*href="([^"]*)"[^>]*class="[^"]*episode[^"]*"[^>]*>.*?(\d+).*?<\/a>/gi
    ];
    
    for (const pattern of episodePatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const url = makeAbsoluteUrl(match[1], 'https://www.cineby.app');
            const episodeNum = parseInt(match[2]);
            
            if (url && episodeNum && !episodes.some(ep => ep.episode === episodeNum)) {
                episodes.push({
                    episode: episodeNum,
                    href: url
                });
            }
        }
    }
    
    // Fallback: numbered links using regex
    if (episodes.length === 0) {
        const numberedLinkRegex = /<a[^>]*href="([^"]*)"[^>]*>.*?(\d+).*?<\/a>/gi;
        let match;
        let episodeCounter = 1;
        
        while ((match = numberedLinkRegex.exec(html)) !== null) {
            const url = makeAbsoluteUrl(match[1], 'https://www.cineby.app');
            const number = parseInt(match[2]);
            
            if (url && number && /(?:watch|play|episode|ep)/i.test(match[0])) {
                episodes.push({
                    episode: number || episodeCounter++,
                    href: url
                });
            }
        }
    }
    
    return episodes.sort((a, b) => a.episode - b.episode);
}

// Extract stream URL from video page using regex only
function extractStreamUrl(html) {
    // Direct video source patterns using regex
    const videoPatterns = [
        /<video[^>]*>.*?<source[^>]*src="([^"]*\.(?:mp4|m3u8|webm))"[^>]*>/is,
        /<video[^>]*src="([^"]*\.(?:mp4|m3u8|webm))"[^>]*>/i,
        /(?:file|source|src)\s*:\s*["']([^"']*\.(?:mp4|m3u8|webm))[^"']*/i,
        /["'](?:file|source|src)["']\s*:\s*["']([^"']*\.(?:mp4|m3u8|webm))[^"']*/i,
        /video_url\s*[:=]\s*["']([^"']*)[^"']*/i,
        /stream_url\s*[:=]\s*["']([^"']*)[^"']*/i
    ];
    
    for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            const url = makeAbsoluteUrl(match[1], 'https://www.cineby.app');
            if (/\.(?:mp4|m3u8|webm)(?:\?|$)/i.test(url)) {
                return url;
            }
        }
    }
    
    // Iframe source using regex
    const iframeRegex = /<iframe[^>]*src="([^"]*)"[^>]*>/i;
    const iframeMatch = html.match(iframeRegex);
    if (iframeMatch) {
        return makeAbsoluteUrl(iframeMatch[1], 'https://www.cineby.app');
    }
    
    // Data attributes using regex
    const dataPatterns = [
        /data-(?:src|url|stream|file)="([^"]*)"[^>]*>/i,
        /data-video-src="([^"]*)"[^>]*>/i,
        /data-player-url="([^"]*)"[^>]*>/i
    ];
    
    for (const pattern of dataPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return makeAbsoluteUrl(match[1], 'https://www.cineby.app');
        }
    }
    
    // JavaScript variable patterns using regex
    const jsPatterns = [
        /var\s+(?:video_url|stream_url|file)\s*=\s*["']([^"']*)[^"']*/i,
        /(?:videoUrl|streamUrl|fileUrl)\s*[:=]\s*["']([^"']*)[^"']*/i,
        /player\.src\s*=\s*["']([^"']*)[^"']*/i
    ];
    
    for (const pattern of jsPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return makeAbsoluteUrl(match[1], 'https://www.cineby.app');
        }
    }
    
    return '';
}

// Export functions for Sora
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        searchResults,
        extractDetails,
        extractEpisodes,
        extractStreamUrl
    };
}
