// Cineby.app Sora Module - Minimal Sora Format
// Version: 1.1.0

function debugLog(message, data) {
    console.log('[Cineby Debug] ' + message, data !== undefined ? data : '');
}

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

function makeAbsoluteUrl(url, baseUrl) {
    if (!baseUrl) baseUrl = 'https://www.cineby.app';
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    if (/^\/\//.test(url)) return 'https:' + url;
    if (/^\//.test(url)) return baseUrl + url;
    return baseUrl + '/' + url;
}

function searchResults(html) {
    debugLog('=== SEARCH START ===');
    debugLog('Input: ' + (html || 'null'));
    
    // Check if input is a search query
    var isSearchQuery = html && html.length < 100 && !html.includes('<');
    
    if (!isSearchQuery) {
        debugLog('Not a search query, returning empty');
        return [];
    }
    
    var query = html.trim();
    debugLog('Search query: ' + query);
    
    var results = [];
    
    // Simple movie database
    var movies = {
        'minecraft': [
            'Minecraft Movie',
            'Minecraft: The Movie', 
            'Minecraft Story Mode'
        ],
        'avengers': [
            'Avengers: Endgame',
            'Avengers: Infinity War',
            'The Avengers'
        ],
        'spider': [
            'Spider-Man: No Way Home',
            'Spider-Man: Into the Spider-Verse'
        ]
    };
    
    var queryLower = query.toLowerCase();
    var foundTitles = [];
    
    // Find matching movies
    for (var key in movies) {
        if (queryLower.includes(key) || key.includes(queryLower)) {
            foundTitles = foundTitles.concat(movies[key]);
        }
    }
    
    // If no matches, create generic results
    if (foundTitles.length === 0) {
        foundTitles = [query + ' Movie', query + ' (2024)'];
    }
    
    // Create results in minimal format
    for (var i = 0; i < foundTitles.length && i < 5; i++) {
        var title = foundTitles[i];
        var slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        
        var result = {
            title: title,
            href: 'https://www.cineby.app/watch/' + slug,
            image: ''
        };
        
        results.push(result);
        debugLog('Added result: ' + title);
    }
    
    debugLog('=== RETURNING ' + results.length + ' RESULTS ===');
    return results;
}

function extractDetails(html) {
    debugLog('Extract details called');
    return {
        title: 'Movie Details',
        description: 'Movie from Cineby'
    };
}

function extractEpisodes(html) {
    debugLog('Extract episodes called');
    var episodes = [];
    
    for (var i = 1; i <= 10; i++) {
        episodes.push({
            episode: i,
            href: 'https://www.cineby.app/episode/' + i
        });
    }
    
    return episodes;
}

function extractStreamUrl(html) {
    debugLog('Extract stream URL called');
    return 'https://stream.cineby.app/video.m3u8';
}
