// Cineby.app Sora Module - Enhanced Debug Version
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

// Search for movies and TV shows - Enhanced Debug Version
function searchResults(html) {
    debugLog('=== SEARCH DEBUG START ===');
    debugLog('HTML received:', !!html);
    debugLog('HTML type:', typeof html);
    debugLog('HTML length:', html ? html.length : 'HTML is null/undefined');
    
    if (!html) {
        debugLog('ERROR: No HTML content received - website may be down or blocking requests');
        return [];
    }
    
    if (html.length === 0) {
        debugLog('ERROR: Empty HTML content - no response from server');
        return [];
    }
    
    // Check for common blocking scenarios
    if (html.includes('403') || html.includes('Forbidden') || html.includes('Access Denied')) {
        debugLog('ERROR: Access denied - website is blocking requests (403)');
        return [];
    }
    
    if (html.includes('cloudflare') || html.includes('checking your browser')) {
        debugLog('ERROR: Cloudflare protection detected');
        return [];
    }
    
    if (html.includes('captcha') || html.includes('CAPTCHA')) {
        debugLog('ERROR: CAPTCHA protection detected');
        return [];
    }
    
    debugLog('HTML sample (first 1000 chars):', html.substring(0, 1000));
    debugLog('=== STARTING EXTRACTION ===');
    
    var results = [];
    
    try {
        // Method 1: Look for common movie/show containers
        debugLog('Method 1: Container extraction');
        var containerPatterns = [
            /<div[^>]*class="[^"]*(?:movie|film|show|card|item|result|content)[^"]*"[^>]*>.*?<\/div>/gis,
            /<article[^>]*class="[^"]*(?:movie|film|show|card|item)[^"]*"[^>]*>.*?<\/article>/gis,
            /<li[^>]*class="[^"]*(?:movie|film|show|item|result)[^"]*"[^>]*>.*?<\/li>/gis,
            /<div[^>]*id="[^"]*(?:movie|film|show|result)[^"]*"[^>]*>.*?<\/div>/gis
        ];
        
        for (var i = 0; i < containerPatterns.length; i++) {
            var pattern = containerPatterns[i];
            var matches = html.match(pattern) || [];
            debugLog('Pattern ' + (i+1) + ' found ' + matches.length + ' containers');
            
            for (var j = 0; j < matches.length && results.length < 20; j++) {
                var match = matches[j];
                
                // Extract title from various sources
                var titlePatterns = [
                    /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i,
                    /<[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/[^>]*>/i,
                    /<a[^>]*title="([^"]*)"[^>]*>/i,
                    /<img[^>]*alt="([^"]*)"[^>]*>/i,
                    /<[^>]*data-title="([^"]*)"[^>]*>/i
                ];
                
                var title = '';
                for (var k = 0; k < titlePatterns.length; k++) {
                    var titleMatch = match.match(titlePatterns[k]);
                    if (titleMatch && titleMatch[1]) {
                        title = cleanTitle(titleMatch[1]);
                        if (title.length > 2) break;
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
                    debugLog('Found result: ' + title);
                }
            }
            
            if (results.length > 0) break;
        }
        
        // Method 2: Simple link extraction if containers failed
        if (results.length === 0) {
            debugLog('Method 2: Simple link extraction');
            
            var linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
            var match;
            var linkCount = 0;
            
            while ((match = linkRegex.exec(html)) !== null && results.length < 20) {
                linkCount++;
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
                    href.indexOf('/about') === -1 &&
                    linkContent.length > 2) {
                    
                    var title = cleanTitle(linkContent);
                    
                    if (title && title.length > 2 && 
                        !/^(home|about|contact|login|register|search|menu|nav)$/i.test(title)) {
                        
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
                        
                        debugLog('Link extraction found: ' + title);
                    }
                }
            }
            
            debugLog('Processed ' + linkCount + ' total links');
        }
        
        // Method 3: Title attribute extraction
        if (results.length === 0) {
            debugLog('Method 3: Title attribute extraction');
            
            var titleAttrPatterns = [
                /title="([^"]*(?:movie|film|show|series|episode)[^"]*)"/gi,
                /alt="([^"]*(?:movie|film|show|series|episode)[^"]*)"/gi,
                /data-title="([^"]*)"/gi
            ];
            
            for (var i = 0; i < titleAttrPatterns.length; i++) {
                var pattern = titleAttrPatterns[i];
                var match;
                while ((match = pattern.exec(html)) !== null && results.length < 10) {
                    var title = cleanTitle(match[1]);
                    if (title && title.length > 3) {
                        results.push({
                            title: title,
                            image: '',
                            href: 'https://www.cineby.app/watch/' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                        });
                        debugLog('Title attribute found: ' + title);
                    }
                }
            }
        }
        
        // Method 4: JSON-LD structured data
        if (results.length === 0) {
            debugLog('Method 4: JSON-LD extraction');
            
            var jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
            var jsonMatches = html.match(jsonLdRegex) || [];
            debugLog('Found ' + jsonMatches.length + ' JSON-LD scripts');
            
            for (var i = 0; i < jsonMatches.length; i++) {
                var jsonMatch = jsonMatches[i];
                var jsonContent = jsonMatch.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                
                var nameMatch = jsonContent.match(/"name"\s*:\s*"([^"]*)"/i);
                var urlMatch = jsonContent.match(/"url"\s*:\s*"([^"]*)"/i);
                var imageMatch = jsonContent.match(/"image"\s*:\s*"([^"]*)"/i);
                var typeMatch = jsonContent.match(/"@type"\s*:\s*"(Movie|TVSeries|VideoObject)"/i);
                
                if (nameMatch && typeMatch) {
                    var title = cleanTitle(nameMatch[1]);
                    var url = urlMatch ? makeAbsoluteUrl(urlMatch[1]) : '';
                    var image = imageMatch ? makeAbsoluteUrl(imageMatch[1]) : '';
                    
                    if (title) {
                        results.push({
                            title: title,
                            image: image,
                            href: url || ('https://www.cineby.app/watch/' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
                        });
                        debugLog('JSON-LD found: ' + title);
                    }
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
            if (!isDuplicate && uniqueResults.length < 20) {
                uniqueResults.push(result);
            }
        }
        
        debugLog('=== EXTRACTION COMPLETE ===');
        debugLog('Total unique results found: ' + uniqueResults.length);
        
        if (uniqueResults.length > 0) {
            debugLog('Sample results:');
            for (var i = 0; i < Math.min(3, uniqueResults.length); i++) {
                debugLog('Result ' + (i+1) + ': ' + uniqueResults[i].title + ' -> ' + uniqueResults[i].href);
            }
        } else {
            debugLog('No results found - this may indicate:');
            debugLog('1. Website structure has changed');
            debugLog('2. Search returned no results');
            debugLog('3. Content is loaded dynamically via JavaScript');
            debugLog('4. Website is using anti-bot protection');
        }
        
        return uniqueResults;
        
    } catch (error) {
        debugLog('ERROR in searchResults: ' + error.message);
        debugLog('Error stack: ' + error.stack);
        return [];
    }
}

// Extract details from movie/show page
function extractDetails(html) {
    debugLog('Extracting details from page');
    debugLog('Details HTML length: ' + (html ? html.length : 0));
    
    var details = {};
    
    if (!html || html.length === 0) {
        debugLog('No HTML for details extraction');
        return details;
    }
    
    try {
        // Extract description
        var descPatterns = [
            /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i,
            /<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i,
            /<[^>]*class="[^"]*(?:description|summary|plot|overview|synopsis)[^"]*"[^>]*>(.*?)<\/[^>]*>/is,
            /<p[^>]*class="[^"]*(?:description|summary|plot)[^"]*"[^>]*>(.*?)<\/p>/is
        ];
        
        for (var i = 0; i < descPatterns.length; i++) {
            var match = html.match(descPatterns[i]);
            if (match && match[1]) {
                details.description = cleanTitle(match[1]);
                debugLog('Found description: ' + details.description.substring(0, 100) + '...');
                break;
            }
        }
        
        // Extract year
        var yearPatterns = [
            /<meta[^>]*property="video:release_date"[^>]*content="(\d{4})[^"]*"[^>]*>/i,
            /<[^>]*class="[^"]*(?:year|date|release)[^"]*"[^>]*>.*?(\d{4}).*?<\/[^>]*>/i,
            /(?:year|release|date)[^>]*>.*?(\d{4})/i,
            /(\d{4})/
        ];
        
        for (var i = 0; i < yearPatterns.length; i++) {
            var match = html.match(yearPatterns[i]);
            if (match && match[1]) {
                details.year = match[1];
                debugLog('Found year: ' + details.year);
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
                debugLog('Found title: ' + details.title);
                break;
            }
        }
        
        debugLog('Extracted details complete');
        
    } catch (error) {
        debugLog('Error in extractDetails: ' + error.message);
    }
    
    return details;
}

// Extract episode links for TV shows
function extractEpisodes(html) {
    debugLog('Extracting episodes');
    debugLog('Episodes HTML length: ' + (html ? html.length : 0));
    
    var episodes = [];
    
    if (!html || html.length === 0) {
        debugLog('No HTML for episode extraction');
        return episodes;
    }
    
    try {
        // Look for episode patterns
        var episodePatterns = [
            /<a[^>]*href="([^"]*)"[^>]*>.*?(?:episode|ep)[\s\-]*(\d+).*?<\/a>/gi,
            /<[^>]*class="[^"]*episode[^"]*"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>.*?(\d+).*?<\/a>/gi,
            /<li[^>]*class="[^"]*episode[^"]*"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>/gi,
            /<a[^>]*href="([^"]*)"[^>]*>.*?(\d+).*?<\/a>/gi
        ];
        
        for (var i = 0; i < episodePatterns.length; i++) {
            var pattern = episodePatterns[i];
            var match;
            var episodeCount = 0;
            
            while ((match = pattern.exec(html)) !== null && episodes.length < 50) {
                episodeCount++;
                var href = match[1];
                var episodeNum = match[2] ? parseInt(match[2]) : episodeCount;
                
                if (href && href.indexOf('#') === -1) {
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
                        debugLog('Found episode ' + episodeNum + ': ' + url);
                    }
                }
            }
            
            debugLog('Pattern ' + (i+1) + ' found ' + episodeCount + ' potential episodes');
            if (episodes.length > 0) break;
        }
        
        // Sort episodes by number
        episodes.sort(function(a, b) { return a.episode - b.episode; });
        
        debugLog('Total episodes found: ' + episodes.length);
        
    } catch (error) {
        debugLog('Error in extractEpisodes: ' + error.message);
    }
    
    return episodes;
}

// Extract stream URL from video page
function extractStreamUrl(html) {
    debugLog('Extracting stream URL');
    debugLog('Stream HTML length: ' + (html ? html.length : 0));
    
    if (!html || html.length === 0) {
        debugLog('No HTML for stream extraction');
        return '';
    }
    
    try {
        // Video source patterns
        var patterns = [
            // Direct video sources
            /<video[^>]*>.*?<source[^>]*src="([^"]*\.(?:mp4|m3u8|webm))"[^>]*>/is,
            /<video[^>]*src="([^"]*\.(?:mp4|m3u8|webm))"[^>]*>/i,
            
            // JavaScript variables
            /(?:file|source|src|video_url|stream_url|videoUrl|streamUrl)\s*[:=]\s*["']([^"']*\.(?:mp4|m3u8|webm))[^"']*/i,
            /["'](?:file|source|src|video_url|stream_url)["']\s*:\s*["']([^"']*\.(?:mp4|m3u8|webm))[^"']*/i,
            
            // Generic video patterns
            /(?:file|source|src|video_url|stream_url)\s*[:=]\s*["']([^"']*)[^"']*/i,
            /["'](?:file|source|src)["']\s*:\s*["']([^"']*)[^"']*/i,
            
            // Player configurations
            /player\.src\s*=\s*["']([^"']*)[^"']*/i,
            /\.setup\s*\(\s*\{[\s\S]*?file\s*:\s*["']([^"']*)[^"']*/i,
            
            // Iframe sources
            /<iframe[^>]*src="([^"]*)"[^>]*>/i,
            
            // Data attributes
            /data-(?:src|url|stream|file|video)="([^"]*)"[^>]*>/i,
            
            // HLS specific
            /\.m3u8[^"']*/gi,
            
            // MP4 specific
            /\.mp4[^"']*/gi
        ];
        
        for (var i = 0; i < patterns.length; i++) {
            var match = html.match(patterns[i]);
            if (match && match[1]) {
                var url = makeAbsoluteUrl(match[1]);
                debugLog('Found potential stream URL (pattern ' + (i+1) + '): ' + url);
                
                // Prefer direct video files
                if (/\.(?:mp4|m3u8|webm)(?:\?|$)/i.test(url)) {
                    debugLog('Returning direct video file: ' + url);
                    return url;
                }
                
                // Return first valid URL found
                if (url.indexOf('http') === 0) {
                    debugLog('Returning stream URL: ' + url);
                    return url;
                }
            }
        }
        
        debugLog('No stream URL found in HTML');
        return '';
        
    } catch (error) {
        debugLog('Error in extractStreamUrl: ' + error.message);
        return '';
    }
}
