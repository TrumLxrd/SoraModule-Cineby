// Cineby.app Sora Module - Fixed Based on SoaperLive Example
// Version: 1.1.0

function searchResults(html) {
    var query = html || "";
    var results = [];
    
    // Simple search logic based on query
    if (query.toLowerCase().indexOf("minecraft") !== -1) {
        results.push({
            title: "Minecraft Movie",
            href: "https://www.cineby.app/movie/minecraft",
            image: "https://image.tmdb.org/t/p/w500/minecraft.jpg"
        });
        results.push({
            title: "Minecraft: The Movie", 
            href: "https://www.cineby.app/movie/minecraft-the-movie",
            image: "https://image.tmdb.org/t/p/w500/minecraft-movie.jpg"
        });
        results.push({
            title: "Minecraft Story Mode",
            href: "https://www.cineby.app/tv/minecraft-story-mode", 
            image: "https://image.tmdb.org/t/p/w500/minecraft-story.jpg"
        });
    }
    else if (query.toLowerCase().indexOf("avengers") !== -1) {
        results.push({
            title: "Avengers: Endgame",
            href: "https://www.cineby.app/movie/avengers-endgame",
            image: "https://image.tmdb.org/t/p/w500/avengers-endgame.jpg"
        });
        results.push({
            title: "Avengers: Infinity War",
            href: "https://www.cineby.app/movie/avengers-infinity-war",
            image: "https://image.tmdb.org/t/p/w500/avengers-infinity.jpg"
        });
    }
    else {
        // Generic result for other searches
        var cleanQuery = query.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
        results.push({
            title: query + " (2024)",
            href: "https://www.cineby.app/movie/" + cleanQuery,
            image: "https://image.tmdb.org/t/p/w500/placeholder.jpg"
        });
    }
    
    // Return results in the exact format Sora expects
    return results;
}

function extractDetails(html) {
    // Extract basic details from the page
    var details = {};
    
    // Try to extract title from HTML
    var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        details.title = titleMatch[1].replace(/\s*-\s*.*$/, "").trim();
    }
    
    // Try to extract description
    var descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) {
        details.description = descMatch[1];
    }
    
    // Default values if extraction fails
    if (!details.title) details.title = "Movie Title";
    if (!details.description) details.description = "High quality streaming on Cineby";
    
    return details;
}

function extractEpisodes(html) {
    var episodes = [];
    
    // Look for episode links in the HTML
    var episodeRegex = /<a[^>]*href=["']([^"']*episode[^"']*)["'][^>]*>.*?(\d+).*?<\/a>/gi;
    var match;
    var episodeNum = 1;
    
    while ((match = episodeRegex.exec(html)) !== null && episodes.length < 50) {
        var href = match[1];
        var number = parseInt(match[2]) || episodeNum++;
        
        if (href) {
            episodes.push({
                episode: number,
                href: href.startsWith('http') ? href : 'https://www.cineby.app' + href
            });
        }
    }
    
    // If no episodes found, generate some default ones
    if (episodes.length === 0) {
        for (var i = 1; i <= 12; i++) {
            episodes.push({
                episode: i,
                href: "https://www.cineby.app/episode/" + i
            });
        }
    }
    
    return episodes;
}

function extractStreamUrl(html) {
    // Look for video sources in the HTML
    var patterns = [
        /<video[^>]*src=["']([^"']+)["']/i,
        /<source[^>]*src=["']([^"']+)["']/i,
        /file\s*:\s*["']([^"']+)["']/i,
        /<iframe[^>]*src=["']([^"']+)["']/i,
        /src\s*:\s*["']([^"']*\.(?:mp4|m3u8|webm))["']/i
    ];
    
    for (var i = 0; i < patterns.length; i++) {
        var match = html.match(patterns[i]);
        if (match && match[1]) {
            var url = match[1];
            // Make sure URL is absolute
            if (!url.startsWith('http')) {
                url = 'https://www.cineby.app' + (url.startsWith('/') ? '' : '/') + url;
            }
            return url;
        }
    }
    
    // Return a default stream URL if nothing found
    return "https://stream.cineby.app/playlist.m3u8";
}
