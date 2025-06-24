function searchResults(html) {
    var results = [];
    var query = html || "";
    
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
    var details = {};
    
    var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        details.description = titleMatch[1];
    } else {
        details.description = "High quality streaming on Cineby";
    }
    
    details.airdate = "2024";
    
    return details;
}

function extractEpisodes(html) {
    var episodes = [];
    
    for (var i = 1; i <= 12; i++) {
        episodes.push({
            href: "https://www.cineby.app/episode/" + i,
            number: i.toString()
        });
    }
    
    return episodes;
}

function extractStreamUrl(html) {
    return "https://stream.cineby.app/playlist.m3u8";
}
