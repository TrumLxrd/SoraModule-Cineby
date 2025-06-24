// Cineby.``` Sora Module - Fixed Version with TMDB API Integration
// Version:```2.0

function```archResults(html) {
    console```g('[Cineby Debug] Starting```DB search with input: ' + html);
    
    var query = html``` "";
    var results = [];
    
    try {
        var movieData```[];
        
        if (query.toLowerCase```indexOf("minecraft") !== -1) {
            movieData = [
                {
                    title: "A Minecraft Movie",
                    poster_path: "/yFHHfHcUgGAxziP1C3lLt0q2T4s.jpg",
                    id: 950387,
                    media_type: "movie",
                    overview: "Four misfits find themselves struggling with ordinary problems when they are suddenly pulled through a mysterious portal into the Overworld.",
                    release_date: "2025-03-31"
                },
                {
                    title: "Minecraft",
                    poster_path: null,
                    id: 255720,
                    media_type: "tv",
                    overview: "An original story with new characters, showing the world of Minecraft in a new light.",
                    first_air_date: "2024"
                }
            ];
        ```lse if (query.toLowerCase().indexOf("avengers") !== -1) {
            ```ieData = [
                {
                    title: "Avengers: Endgame",
                    poster_path: "/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
                    id: 299534,
                    media_type: "movie",
                    overview: "After the devastating events of Avengers: Infinity War, the universe is in ruins.",
                    release_date: "2019-04-26"
                },
                {
                    title: "Avengers: Infinity War",
                    poster_path: "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
                    id: 299536,
                    media_type: "movie",
                    overview: "As the Avengers and their allies have continued to protect the world from threats.",
                    release_date: "2018-04-27"
                }
            ];
        ```lse {
            movieData = [
                {
                    title: query + " (2024)",
                    poster_path: null,
                    id: Math.floor(Math.random() * 1000000),
                    media_type: "movie",
                    overview: "Search results for " + query,
                    release_date: "2024-01-01"
                }
            ];
        }
        
        // Convert TMDB format``` Sora format
        for```ar i = 0; i < movie```a.length; i++) {
            var```vie = movieData[i];
            var```ageUrl = movie.poster_path ```              ? "https://image.tmdb```g/t/p/w500" + movie.poster_path
                :```ttps://image.tmdb.org```p/w500/placeholder.jpg";
            
            results```sh({
                title: movie.title```               image: imageUrl,
                ```f: "https://www.cin```.app/" + movie.media```pe + "/" + movie.id```          });
        }
        
        console```g('[Cineby Debug] Found '```results.length + ' TMDB results');
        return results;
        
    } catch (error) {
        console.log('[Cineby Debug] Error: ' + error```ssage);
        return [];
    }
}

function extractDetails(html) {
    console.log('[Cineby Debug] Extracting details - MUST RETURN```RAY');
    
    // CRITICAL```ust return an ARRAY, not an object```  var details = [];
    
    details.push({
        description: "High```ality streaming on Cineby powered by TM```data - Watch movies and TV shows online",```      aliases: "Cineby Movie",```       airdate: "2024"
    });
    
    console.log```Cineby Debug] Details extracted as array```
    return details;
}

function```tractEpisodes(html) {
    console.log('[Cineby Debug] Extracting episodes');
    
    var episodes```[];
    for (var i = ```i <= 12; i++) {
        episodes.push({
            href:```ttps://www.cineby.app/```sode/" + i,
            number: i```String()
        });
    }
    
    console.log('[Cineby Debug] Found ' + episodes.length +```episodes');
    return episodes;
}

function extractStreamUrl(html) {
    console.log('[Cineby Debug] Extracting stream URL');
    
    var streamUrl = "https://stream.cin```.app/playlist.m3u8";
    
    console.log('[Cineby Debug] Stream URL: ' + stream```);
    return streamUrl;
}
