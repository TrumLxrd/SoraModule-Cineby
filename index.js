function cineby() {
  this.name = "Cineby";
  this.baseUrl = "https://www.cineby.app";
  this.search_url = this.baseUrl + "/search/";
  this.tmdb_api_key = "d9956abacedb5b43a16cc4864b26d451";
  this.tmdb_image_base = "https://image.tmdb.org/t/p/w500";
  this.headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
  };
}

// Search function - takes query and type
cineby.prototype.search = function(query, type) {
  var self = this;
  return new Promise(function(resolve, reject) {
    console.log("Searching for " + query + ", type: " + type);
    
    // Define the TMDB endpoint based on content type
    var endpoint = type === "movie" ? "movie" : "tv";
    var tmdbUrl = "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + self.tmdb_api_key + "&query=" + encodeURIComponent(query);
    
    fetch(tmdbUrl)
      .then(function(response) {
        if (!response.ok) {
          throw new Error("TMDB search failed: " + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        var results = [];
        
        if (data.results && data.results.length > 0) {
          for (var i = 0; i < data.results.length; i++) {
            var item = data.results[i];
            
            // Get title based on type
            var title = "";
            if (type === "movie") {
              title = item.title || "";
            } else {
              title = item.name || "";
            }
            
            // Get year from release date
            var year = "";
            if (item.release_date) {
              var dateParts = item.release_date.split("-");
              if (dateParts.length > 0) {
                year = dateParts[0];
              }
            } else if (item.first_air_date) {
              var dateParts = item.first_air_date.split("-");
              if (dateParts.length > 0) {
                year = dateParts[0];
              }
            }
            
            // Get poster
            var poster = "";
            if (item.poster_path) {
              poster = self.tmdb_image_base + item.poster_path;
            }
            
            // Add to results
            results.push({
              title: title,
              year: year,
              img: poster,
              tmdbId: item.id,
              url: self.baseUrl + "/" + type + "/" + item.id,
              type: type
            });
          }
        }
        
        console.log("Found " + results.length + " results");
        resolve(results);
      })
      .catch(function(error) {
        console.error("Search error:", error);
        resolve([]);
      });
  });
};

// Get sources for a URL
cineby.prototype.get_sources = function(url) {
  var self = this;
  return new Promise(function(resolve, reject) {
    console.log("Getting sources for: " + url);
    
    // Extract type and ID from URL
    var urlParts = url.split("/");
    var type = urlParts[urlParts.length - 2];
    var tmdbId = urlParts[urlParts.length - 1];
    
    if (!tmdbId || !type) {
      console.error("Invalid URL format");
      resolve([]);
      return;
    }
    
    console.log("Extracted type: " + type + ", tmdbId: " + tmdbId);
    
    // Get TMDB details
    var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + self.tmdb_api_key;
    
    fetch(tmdbUrl)
      .then(function(response) {
        if (!response.ok) {
          throw new Error("TMDB details failed: " + response.status);
        }
        return response.json();
      })
      .then(function(tmdbData) {
        // Get title based on content type
        var title = type === "movie" ? (tmdbData.title || "") : (tmdbData.name || "");
        console.log("Looking for content: " + title);
        
        // Search on Cineby for this title
        var searchUrl = self.search_url + "?q=" + encodeURIComponent(title);
        
        return fetch(searchUrl, { headers: self.headers })
          .then(function(searchResponse) {
            if (!searchResponse.ok) {
              throw new Error("Cineby search failed: " + searchResponse.status);
            }
            return searchResponse.text();
          })
          .then(function(html) {
            // Find matching result
            var resultPattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>.*?<div[^>]*class="[^"]*text-sm[^"]*font-semibold[^"]*"[^>]*>(.*?)<\/div>/g;
            var match;
            var contentUrl = null;
            
            while ((match = resultPattern.exec(html)) !== null) {
              var resultUrl = match[1];
              var resultTitle = match[2].replace(/<.*?>/g, '').trim();
              
              if (resultTitle.toLowerCase().indexOf(title.toLowerCase()) !== -1) {
                contentUrl = resultUrl;
                break;
              }
            }
            
            if (!contentUrl) {
              console.error("No matching content found on Cineby");
              resolve([]);
              return;
            }
            
            // Get full URL
            var fullContentUrl = contentUrl;
            if (!contentUrl.startsWith("http")) {
              fullContentUrl = self.baseUrl + contentUrl;
            }
            
            console.log("Found content URL: " + fullContentUrl);
            
            // Get content page
            return fetch(fullContentUrl, { headers: self.headers })
              .then(function(contentResponse) {
                if (!contentResponse.ok) {
                  throw new Error("Content page fetch failed: " + contentResponse.status);
                }
                return contentResponse.text();
              })
              .then(function(contentHtml) {
                // Check if it's a TV show
                var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1 && 
                               contentHtml.indexOf("Season") !== -1;
                
                var sources = [];
                
                if (isTvShow) {
                  console.log("Detected TV show");
                  sources = self._extract_tv_sources(contentHtml, fullContentUrl);
                } else {
                  console.log("Detected movie");
                  sources = self._extract_movie_sources(contentHtml, fullContentUrl);
                }
                
                resolve(sources);
              });
          });
      })
      .catch(function(error) {
        console.error("Error getting sources:", error);
        resolve([]);
      });
  });
};

// Extract movie sources
cineby.prototype._extract_movie_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  // Find iframe players
  var iframePattern = /<iframe.*?src="([^"]+)"/g;
  var match;
  
  while ((match = iframePattern.exec(html)) !== null) {
    var iframe_src = match[1];
    if (!iframe_src.startsWith('http')) {
      if (iframe_src.startsWith('//')) {
        iframe_src = 'https:' + iframe_src;
      } else {
        iframe_src = self.baseUrl + iframe_src;
      }
    }
    
    console.log("Found iframe source: " + iframe_src);
    sources.push({
      url: iframe_src,
      title: 'Player Source',
      type: 'iframe'
    });
  }
  
  // Find direct video sources
  var videoPattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
  var i = 1;
  
  while ((match = videoPattern.exec(html)) !== null) {
    console.log("Found direct source: " + match[1]);
    sources.push({
      url: match[1],
      title: "Source " + i++,
      type: 'direct'
    });
  }
  
  return sources;
};

// Extract TV sources
cineby.prototype._extract_tv_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  try {
    // Find active season
    var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
    var season = "1";
    if (seasonMatch && seasonMatch.length > 1) {
      season = seasonMatch[1];
    }
    
    // Find episodes
    var episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
    var match;
    
    while ((match = episodePattern.exec(html)) !== null) {
      var episodeUrl = match[1];
      var episodeNum = match[2];
      
      var fullUrl = episodeUrl;
      if (!episodeUrl.startsWith('http')) {
        fullUrl = self.baseUrl + episodeUrl;
      }
      
      sources.push({
        url: fullUrl,
        title: "Season " + season + " Episode " + episodeNum,
        type: 'episode'
      });
    }
    
    // If no episodes found, try alternative pattern
    if (sources.length === 0) {
      var altEpisodePattern = /<a\s+href="([^"]+)"[^>]*>.*?Episode\s+(\d+).*?<\/a>/g;
      
      while ((match = altEpisodePattern.exec(html)) !== null) {
        var episodeUrl = match[1];
        var episodeNum = match[2];
        
        var fullUrl = episodeUrl;
        if (!episodeUrl.startsWith('http')) {
          fullUrl = self.baseUrl + episodeUrl;
        }
        
        sources.push({
          url: fullUrl,
          title: "Season " + season + " Episode " + episodeNum,
          type: 'episode'
        });
      }
    }
    
    return sources;
  } catch (error) {
    console.error("Error extracting TV sources:", error);
    return [];
  }
};

// Get episode sources
cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  return new Promise(function(resolve, reject) {
    fetch(url, { headers: self.headers })
      .then(function(response) {
        if (!response.ok) {
          throw new Error("HTTP error: " + response.status);
        }
        return response.text();
      })
      .then(function(html) {
        var sources = self._extract_movie_sources(html, url);
        resolve(sources);
      })
      .catch(function(error) {
        console.error("Error getting episode sources:", error);
        resolve([]);
      });
  });
};

// Export the module
var module = new cineby();
export default module;
