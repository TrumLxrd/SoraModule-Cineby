// Cineby.app Sora Module - Final Version
// Version: 1.1.0

// Debug logging function
function debugLog(message, data) {
    console.log('[Cineby Debug] ' + message, data || '');
}

// Utility function to clean titles
function cleanTitle(title) {
    if (!title) return '';
    return title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, function(match, dec) { return String.fromCharCode(dec); })
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Utility function to make absolute URLs
function makeAbsoluteUrl(url, baseUrl) {
    if (!baseUrl) baseUrl = 'https://www.cineby.app';
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    if (/^\/\//.test(url)) return 'https:' + url;
    if (/^\//.test(url)) return baseUrl + url;
    return baseUrl + '/' + url;
}

// Search for movies and TV shows
function searchResults(html) {
    debugLog('Starting search results extraction');
    debugLog('HTML length:', html.length);
    debugLog('HTML sample (first 500 chars):', html.substring(0, 500));
    
    var results = [];
    
    try {
        // Primary approach - look for movie/show containers
        var containerPatterns = [
            /<div[^>]*class="[^"]*(?:movie|film|show|card|item|result)[^"]*"[^>]*>.*?<\/div>/gis,
            /<article[^>]*>.*?<\/article>/gis,
            /<li[^>]*class="[^"]*(?:movie|film|show|item)[^"]*"[^>]*>.*?<\/li>/gis
        ];
        
        for (var i = 0; i < containerPatterns.length; i++) {
            var pattern = containerPatterns[i];
            var matches = html.match(pattern) || [];
            debugLog('Found ' + matches.length + ' containers with pattern');
            
            for (var j = 0; j < matches.length; j++) {
                var match = matches[j];
                
                // Extract title
                var titlePatterns = [
                    /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i,
                    /<[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/[^>]*>/i,
                    /<a[^>]*title="([^"]*)"[^>]*>/i,
                    /<img[^>]*alt="([^"]*)"[^>]*>/i
                ];
                
                var title = '';
                for (var k = 0; k < titlePatterns.length; k++) {
                    var titleMatch = match.match(titlePatterns[k]);
                    if (titleMatch && titleMatch[1]) {
                        title = cleanTitle(titleMatch[1]);
                        break;
                    }
                }
                
                // Extract href
                var hrefMatch = match.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
                var href = hrefMatch ? makeAbsoluteUrl(hrefMatch[1]) : '';
                
                // Extract image
                var imgMatch = match.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
                var image = imgMatch ? makeAbsoluteUrl(imgMatch[1]) : '';
                
                if (title && href && title.length > 2) {
                    results.push({ title: title, image: image, href: href });
                }
            }
            
            if (results.length > 0) break;
        }
        
        // Fallback approach - simple link extraction
        if (results.length === 0) {
            debugLog('Using fallback link extraction');
            
            var linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
            var match;
            
            while ((match = linkRegex.exec(html)) !== null) {
                var href = match[1];
                var linkContent = match[2];
                
                // Filter out navigation and utility links
                if (href && 
                    href.indexOf('#') === -1 && 
                    href.indexOf('javascript:') === -1 && 
                    href.indexOf('mailto:') === -1 &&
                    href.indexOf('/search') === -1 &&
                    href.indexOf('/login') === -1 &&
                    href.indexOf('/register') === -1 &&
                    href.indexOf('/contact') === -1 &&
                    linkContent.length > 2) {
                    
                    var title = cleanTitle(linkContent);
                    
                    if (title && title.length > 2 && !/^(home|about|contact|login|register)$/i.test(title)) {
                        var fullHref = makeAbsoluteUrl(href);
                        
                        // Look for nearby image
                        var linkIndex = html.indexOf(match[0]);
                        var contextStart = Math.max(0, linkIndex - 300);
                        var contextEnd = Math.min(html.length, linkIndex + 300);
                        var context = html.substring(contextStart, contextEnd);
                        
                        var imgMatch = context.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
                        var image = imgMatch ? makeAbsoluteUrl(imgMatch[1]) : '';
                        
                        results.push({
                            title: title,
                            image: image,
                            href: fullHref
                        });
                    }
                }
            }
        }
        
        // Third approach - look for structured data
        if (results.length === 0) {
            debugLog('Trying structured data extraction');
            
            var jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
            var jsonMatches = html.match(jsonLdRegex) || [];
            
            for (var i = 0; i < jsonMatches.length; i++) {
                var jsonMatch = jsonMatches[i];
                var jsonContent = jsonMatch.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                
                var nameMatch = jsonContent.match(/"name"\s*:\s*"([^"]*)"/i);
                var urlMatch = jsonContent.match(/"url"\s*:\s*"([^"]*)"/i);
                var imageMatch = jsonContent.match(/"image"\s*:\s*"([^"]*)"/i);
                var typeMatch = jsonContent.match(/"@type"\s*:\s*"(Movie|TVSeries)"/i);
                
                if (nameMatch && urlMatch && typeMatch) {
                    results.push({
                        title: cleanTitle(nameMatch[1]),
                        image: imageMatch ? makeAbsoluteUrl(imageMatch[1]) : '',
                        href: makeAbsoluteUrl(urlMatch[1])
                    });
                }
            }
        }
        
        // Remove duplicates
        var uniqueResults = [];
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            var isDuplicate = false;
            for (var j = 0; j < uniqueResults.length; j++) {
                if (uniqueResults[j].href === result.href || uniqueResults[j].title === result.title) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueResults.push(result);
            }
        }
        
        debugLog('Found ' + uniqueResults.length + ' unique results');
        if (uniqueResults.length > 0) {
            debugLog('Sample results:', uniqueResults.slice(0, 3));
        }
        
        return uniqueResults.slice(0, 20); // Limit to 20 results
        
    } catch (error) {
        debugLog('Error in searchResults:', error.message);
        return [];
    }
}

// Extract details from movie/show page
function extractDetails(html) {
    debugLog('Extracting details from page');
    
    var details = {};
    
    try {
        // Extract description
        var descPatterns = [
            /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i,
            /<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i,
            /<[^>]*class="[^"]*(?:description|summary|plot|overview)[^"]*"[^>]*>(.*?)<\/[^>]*>/is
        ];
        
        for (var i = 0; i < descPatterns.length; i++) {
            var match = html.match(descPatterns[i]);
            if (match && match[1]) {
                details.description = cleanTitle(match[1]);
                break;
            }
        }
        
        // Extract year
        var yearPatterns = [
            /<meta[^>]*property="video:release_date"[^>]*content="(\d{4})[^"]*"[^>]*>/i,
            /<[^>]*class="[^"]*(?:year|date|release)[^"]*"[^>]*>.*?(\d{4}).*?<\/[^>]*>/i,
            /(\d{4})/
        ];
        
        for (var i = 0; i < yearPatterns.length; i++) {
            var match = html.match(yearPatterns[i]);
            if (match && match[1]) {
                details.year = match[1];
                break;
            }
        }
        
        // Extract title
        var titlePatterns = [
            /<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i,
            /<title>([^<]*)<\/title>/i,
            /<h1[^>]*>(.*?)<\/h1>/i
        ];
        
        for (var i = 0; i < titlePatterns.length; i++) {
            var match = html.match(titlePatterns[i]);
            if (match && match[1]) {
                details.title = cleanTitle(match[1]);
                break;
            }
        }
        
        debugLog('Extracted details:', details);
        
    } catch (error) {
        debugLog('Error in extractDetails:', error.message);
    }
    
    return details;
}

// Extract episode links for TV shows
function extractEpisodes(html) {
    debugLog('Extracting episodes');
    
    var episodes = [];
    
    try {
        // Look for episode patterns
        var episodePatterns = [
            /<a[^>]*href="([^"]*)"[^>]*>.*?(?:episode|ep)[\s\-]*(\d+).*?<\/a>/gi,
            /<[^>]*class="[^"]*episode[^"]*"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>.*?(\d+).*?<\/a>/gi,
            /<a[^>]*href="([^"]*)"[^>]*>.*?(\d+).*?<\/a>/gi
        ];
        
        for (var i = 0; i < episodePatterns.length; i++) {
            var pattern = episodePatterns[i];
            var match;
            while ((match = pattern.exec(html)) !== null) {
                var href = match[1];
                var episodeNum = parseInt(match[2]);
                
                if (href && episodeNum && href.indexOf('#') === -1) {
                    var url = makeAbsoluteUrl(href);
                    
                    var isDuplicate = false;
                    for (var j = 0; j < episodes.length; j++) {
                        if (episodes[j].episode === episodeNum || episodes[j].href === url) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (!isDuplicate) {
                        episodes.push({
                            episode: episodeNum,
                            href: url
                        });
                    }
                }
            }
            
            if (episodes.length > 0) break;
        }
        
        debugLog('Found ' + episodes.length + ' episodes');
        
        // Sort episodes by number
        episodes.sort(function(a, b) { return a.episode - b.episode; });
        
        return episodes;
        
    } catch (error) {
        debugLog('Error in extractEpisodes:', error.message);
        return [];
    }
}

// Extract stream URL from video page
function extractStreamUrl(html) {
    debugLog('Extracting stream URL');
    debugLog('HTML length for stream extraction:', html.length);
    
    try {
        // Video source patterns
        var patterns = [
            // Direct video sources
            /<video[^>]*>.*?<source[^>]*src="([^"]*\.(?:mp4|m3u8|webm))"[^>]*>/is,
            /<video[^>]*src="([^"]*\.(?:mp4|m3u8|webm))"[^>]*>/i,
            
            // JavaScript variables
            /(?:file|source|src|video_url|stream_url)\s*[:=]\s*["']([^"']*\.(?:mp4|m3u8|webm))[^"']*/i,
            /["'](?:file|source|src)["']\s*:\s*["']([^"']*\.(?:mp4|m3u8|webm))[^"']*/i,
            
            // Generic patterns
            /src\s*[:=]\s*["']([^"']*)[^"']*/i,
            /file\s*[:=]\s*["']([^"']*)[^"']*/i,
            
            // Iframe sources
            /<iframe[^>]*src="([^"]*)"[^>]*>/i,
            
            // Data attributes
            /data-(?:src|url|stream|file)="([^"]*)"[^>]*>/i
        ];
        
        for (var i = 0; i < patterns.length; i++) {
            var match = html.match(patterns[i]);
            if (match && match[1]) {
                var url = makeAbsoluteUrl(match[1]);
                debugLog('Found potential stream URL:', url);
                
                // Prefer direct video files
                if (/\.(?:mp4|m3u8|webm)(?:\?|$)/i.test(url)) {
                    debugLog('Returning video file URL:', url);
                    return url;
                }
                
                // Return first valid URL found
                if (url.indexOf('http') === 0) {
                    debugLog('Returning stream URL:', url);
                    return url;
                }
            }
        }
        
        debugLog('No stream URL found');
        return '';
        
    } catch (error) {
        debugLog('Error in extractStreamUrl:', error.message);
        return '';
    }
}
