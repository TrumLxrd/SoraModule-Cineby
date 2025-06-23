function Cineby() {
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

// Search function
Cineby.prototype.search = function(query, type) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    console.log("Searching for " + query + ", type: " + type);
    
    var endpoint = type === "movie" ? "movie" : "tv";
    var tmdbUrl = "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + self.tmdb_api_key + "&query=" + encodeURIComponent(query);
    
    fetch(tmdbUrl)
      .then(function(response) { return response.json(); })
      .then(function(data) {
        var results = [];
        
        if (data.results && data.results.length > 0) {
          for (var i = 0; i < data.results.length; i++) {
            var item = data.results[i];
            
            var title = "";
            if (type === "movie") {
              title = item.title || "";
            } else {
              title = item.name || "";
            }
            
            var year = "";
            if (item.release_date) {
              year = item.release_date.split("-")[0];
            } else if (item.first_air_date) {
              year = item.first_air_date.split("-")[0];
            }
            
            var poster = "";
            if (item.poster_path) {
              poster = self.tmdb_image_base + item.poster_path;
            }
            
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
Cineby.prototype.get_sources = function(url) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    console.log("Getting sources for: " + url);
    
    var urlParts = url.split("/");
    var type = urlParts[urlParts.length - 2];
    var tmdbId = urlParts[urlParts.length - 1];
    
    if (!tmdbId || !type) {
      console.error("Invalid URL format");
      resolve([]);
      return;
    }
    
    var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + self.tmdb_api_key;
    
    fetch(tmdbUrl)
      .then(function(response) { return response.json(); })
      .then(function(tmdbData) {
        var title = type === "movie" ? (tmdbData.title || "") : (tmdbData.name || "");
        var searchUrl = self.search_url + "?q=" + encodeURIComponent(title);
        
        return fetch(searchUrl, { headers: self.headers })
          .then(function(searchResponse) { return searchResponse.text(); })
          .then(function(html) {
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
            
            var fullContentUrl = contentUrl;
            if (contentUrl.indexOf("http") !== 0) {
              fullContentUrl = self.baseUrl + contentUrl;
            }
            
            return fetch(fullContentUrl, { headers: self.headers })
              .then(function(contentResponse) { return contentResponse.text(); })
              .then(function(contentHtml) {
                var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1 && 
                               contentHtml.indexOf("Season") !== -1;
                
                var sources = [];
                
                if (isTvShow) {
                  sources = self._extract_tv_sources(contentHtml, fullContentUrl);
                } else {
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
Cineby.prototype._extract_movie_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  var iframePattern = /<iframe.*?src="([^"]+)"/g;
  var match;
  
  while ((match = iframePattern.exec(html)) !== null) {
    var iframe_src = match[1];
    if (iframe_src.indexOf("http") !== 0) {
      if (iframe_src.indexOf("//") === 0) {
        iframe_src = 'https:' + iframe_src;
      } else {
        iframe_src = self.baseUrl + iframe_src;
      }
    }
    
    sources.push({
      url: iframe_src,
      title: 'Player Source',
      type: 'iframe'
    });
  }
  
  var videoPattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
  var i = 1;
  
  while ((match = videoPattern.exec(html)) !== null) {
    sources.push({
      url: match[1],
      title: "Source " + i++,
      type: 'direct'
    });
  }
  
  return sources;
};

// Extract TV sources
Cineby.prototype._extract_tv_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  try {
    var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
    var season = "1";
    if (seasonMatch && seasonMatch.length > 1) {
      season = seasonMatch[1];
    }
    
    var episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
    var match;
    
    while ((match = episodePattern.exec(html)) !== null) {
      var episodeUrl = match[1];
      var episodeNum = match[2];
      
      var fullUrl = episodeUrl;
      if (episodeUrl.indexOf("http") !== 0) {
        fullUrl = self.baseUrl + episodeUrl;
      }
      
      sources.push({
        url: fullUrl,
        title: "Season " + season + " Episode " + episodeNum,
        type: 'episode'
      });
    }
    
    return sources;
  } catch (error) {
    console.error("Error extracting TV sources:", error);
    return [];
  }
};

// Get episode sources
Cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    fetch(url, { headers: self.headers })
      .then(function(response) { return response.text(); })
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

// Create and export module instance
var module = new Cineby();
module.exports = module;
