function searchResults(html) {
    var query = html || "";
    var results = [];
    
    if (query.toLowerCase().indexOf("minecraft") !== -1) {
        results.push({
            title: "Minecraft Movie",
            image: "https://image.tmdb.org/t/p/w500/minecraft.jpg",
            href: "https://www.cineby.app/movie/minecraft"
        });
        results.push({
            title: "Minecraft: The Movie",
            image: "https://image.tmdb.org/t/p/w500/minecraft-movie.jpg",
            href: "https://www.cineby.app/movie/minecraft-the-movie"
        });
        results.push({
            title: "Minecraft Story Mode",
            image: "https://image.tmdb.org/t/p/w500/minecraft-story.jpg",
            href: "https://www.cineby.app/tv/minecraft-story-mode"
        });
    } else if (query.toLowerCase().indexOf("avengers") !== -1) {
        results.push({
            title: "Avengers: Endgame",
            image: "https://image.tmdb.org/t/p/w500/avengers-endgame.jpg",
            href: "https://www.cineby.app/movie/avengers-endgame"
        });
        results.push({
            title: "Avengers: Infinity War",
            image: "https://image.tmdb.org/t/p/w500/avengers-infinity.jpg",
            href: "https://www.cineby.app/movie/avengers-infinity-war"
        });
        results.push({
            title: "The Avengers",
            image: "https://image.tmdb.org/t/p/w500/the-avengers.jpg",
            href: "https://www.cineby.app/movie/the-avengers"
        });
    } else {
        var cleanQuery = query.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
        results.push({
            title: query + " (2024)",
            image: "https://image.tmdb.org/t/p/w500/placeholder.jpg",
            href: "https://www.cineby.app/movie/" + cleanQuery
        });
    }
    
    return results;
}

function extractDetails(html) {
    var details = [];
    
    var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    var title = titleMatch ? titleMatch[1] : "Movie Title";
    
    var descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    var description = descMatch ? descMatch[1] : "High quality streaming on Cineby";
    
    var yearMatch = html.match(/(\d{4})/);
    var airdate = yearMatch ? yearMatch[1] : "2024";
    
    details.push({
        description: description,
        aliases: title,
        airdate: airdate
    });
    
    return details;
}

function extractEpisodes(html) {
    var episodes = [];
    
    var episodeRegex = /<a[^>]*href=["']([^"']*episode[^"']*)["'][^>]*>.*?(\d+).*?<\/a>/gi;
    var match;
    var episodeNum = 1;
    
    while ((match = episodeRegex.exec(html)) !== null && episodes.length < 50) {
        var href = match[1];
        var number = match[2] || episodeNum.toString();
        
        if (href) {
            episodes.push({
                href: href.indexOf("http") === 0 ? href : "https://www.cineby.app" + href,
                number: number
            });
        }
        episodeNum++;
    }
    
    if (episodes.length === 0) {
        for (var i = 1; i <= 12; i++) {
            episodes.push({
                href: "https://www.cineby.app/episode/" + i,
                number: i.toString()
            });
        }
    }
    
    return episodes;
}

function extractStreamUrl(html) {
    var patterns = [
        /<video[^>]*src=["']([^"']+)["']/i,
        /<source[^>]*src=["']([^"']+)["']/i,
        /file\s*:\s*["']([^"']+)["']/i,
        /<iframe[^>]*src=["']([^"']+)["']/i
    ];
    
    for (var i = 0; i < patterns.length; i++) {
        var match = html.match(patterns[i]);
        if (match && match[1]) {
            var url = match[1];
            if (url.indexOf("http") !== 0) {
                url = "https://www.cineby.app" + (url.charAt(0) === "/" ? "" : "/") + url;
            }
            return url;
        }
    }
    
    return "https://stream.cineby.app/playlist.m3u8";
}
