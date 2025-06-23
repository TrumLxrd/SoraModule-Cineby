function Cineby() {
  this.name = "Cineby";
  this.baseUrl = "https://www.cineby.app";
}

Cineby.prototype.search = function(query, type) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    var tmdbApiKey = "d9956abacedb5b43a16cc4864b26d451";
    var tmdbType = type === "movie" ? "movie" : "tv";
    var tmdbUrl = "https://api.themoviedb.org/3/search/" + tmdbType + "?api_key=" + tmdbApiKey + "&query=" + encodeURIComponent(query);
    
    fetch(tmdbUrl)
      .then(function(response) { return response.json(); })
      .then(function(data) {
        var results = [];
        
        if (data.results) {
          for (var i = 0; i < data.results.length; i++) {
            var item = data.results[i];
            var title = tmdbType === "movie" ? item.title : item.name;
            var year = "";
            
            if (tmdbType === "movie" && item.release_date) {
              year = item.release_date.split("-")[0];
            } else if (item.first_air_date) {
              year = item.first_air_date.split("-")[0];
            }
            
            var poster = item.poster_path 
              ? "https://image.tmdb.org/t/p/w500" + item.poster_path 
              : "";
            
            results.push({
              title: title,
              url: self.baseUrl + "/" + tmdbType + "/" + item.id,
              img: poster,
              year: year
            });
          }
        }
        
        resolve(results);
      })
      .catch(function(error) {
        console.error("Search error:", error);
        resolve([]);
      });
  });
};

Cineby.prototype.get_sources = function(url) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    var urlParts = url.split("/");
    var type = urlParts[urlParts.length - 2];
    var tmdbId = urlParts[urlParts.length - 1];
    var tmdbApiKey = "d9956abacedb5b43a16cc4864b26d451";
    
    fetch("https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + tmdbApiKey)
      .then(function(response) { return response.json(); })
      .then(function(data) {
        var title = type === "movie" ? data.title : data.name;
        
        // Search on Cineby
        var searchUrl = self.baseUrl + "/search/?q=" + encodeURIComponent(title);
        
        return fetch(searchUrl)
          .then(function(response) { return response.text(); })
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
              resolve([]);
              return;
            }
            
            var fullContentUrl = contentUrl.indexOf("http") === 0 
              ? contentUrl 
              : self.baseUrl + contentUrl;
            
            return fetch(fullContentUrl)
              .then(function(response) { return response.text(); })
              .then(function(contentHtml) {
                var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1 && 
                               contentHtml.indexOf("Season") !== -1;
                
                if (isTvShow) {
                  return self._extract_tv_sources(contentHtml, fullContentUrl);
                } else {
                  return self._extract_movie_sources(contentHtml, fullContentUrl);
                }
              })
              .then(function(sources) {
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

Cineby.prototype._extract_movie_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  // Find iframe sources
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
  
  // Find direct video sources
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

Cineby.prototype._extract_tv_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  // Find active season
  var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
  var season = seasonMatch && seasonMatch.length > 1 ? seasonMatch[1] : "1";
  
  // Find episodes
  var episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
  var match;
  
  while ((match = episodePattern.exec(html)) !== null) {
    var episodeUrl = match[1];
    var episodeNum = match[2];
    
    var fullUrl = episodeUrl.indexOf("http") === 0 
      ? episodeUrl 
      : self.baseUrl + episodeUrl;
    
    sources.push({
      url: fullUrl,
      title: "Season " + season + " Episode " + episodeNum,
      type: 'episode'
    });
  }
  
  return sources;
};

Cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    fetch(url)
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

var module = new Cineby();
export default module;
