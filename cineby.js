function```archResults(html) {
    var query = html || "";
    var results =```;
    
    if (query.toLowerCase```indexOf("minecraft") !== -1) {
        results.push({
            title: "```ecraft Movie",
            image:```ttps://image.tmdb.org/```/w500/minecraft.jpg",
            href: "https://```.cineby.app/movie/minecraft```       });
        results.push({
            title: "Minecraft: The Movie",
            image```https://image.tmdb.org```p/w500/minecraft-movie.jpg",
            href: "https://```.cineby.app/movie/minecraft```e-movie"
        });
        ```ults.push({
            title: "```ecraft Story Mode",
            image```https://image.tmdb.org```p/w500/minecraft-story.jpg",
            href: "https```www.cineby.app/tv/minecraft-story-mode"
        });
    } else if (query.toLowerCase().indexOf("avengers") !== -1) {
        results.push({
            ```le: "Avengers: Endg```",
            image: "https://image```db.org/t/p/w500/avengers-endgame.jpg```            href: "https://www.```eby.app/movie/avengers-endgame"
        });
        results```sh({
            title: "Av```ers: Infinity War",
            image:```ttps://image.tmdb.org/```/w500/avengers-infinity.jpg",
            href: "https```www.cineby.app/movie/avengers-infinity-war"
        });
        results.push({
            title:```he Avengers",```          image: "https://image.tmdb```g/t/p/w500/the-avengers.jpg```            href: "https://www.```eby.app/movie/the-avengers```       });
    } else {
        var cleanQuery = query.replace```^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
        results.push({
            title:```ery + " (2024)",
            image```https://image.tmdb.org```p/w500/placeholder.jpg",
            href: "https://www```neby.app/movie/" + clean```ry
        });
    }
    
    return results;
}

function extractDetails```ml) {
    var details = [];
    details.push({
        description:```igh quality streaming on Cineby - Watch movies and TV shows online",
        aliases:```ineby Movie",
        airdate```2024"
    });
    return details;
}

function extractEpis```s(html) {
    var episodes =```;
    for (var i = 1; i <= 12; i++) {
        episodes.push({
            href: "```ps://www.cineby.app/episode```+ i,
            number: i.```tring()
        });
    }
    return episodes;
}

function extractStreamUrl```ml) {
    return "https://```eam.cineby.app/playlist.m```";
}
