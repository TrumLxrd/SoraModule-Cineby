// Define the module directly
var module = {
  name: "Cineby",
  baseUrl: "https://www.cineby.app",
  tmdb_api_key: "d9956abacedb5b43a16cc4864b26d451",
  tmdb_image_base: "https://image.tmdb.org/t/p/w500",
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  },

  // Search function
  search: function(query, type) {
    var self = this;
    
    return new Promise(function(resolve) {
      console.log("Searching for " + query + ", type: " + type);
      
      // Define the TMDB endpoint based on content type
      var endpoint = type === "movie" ? "movie" : "tv";
      var tmdbUrl = "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + self.tmdb_api_key + "&query=" + encodeURIComponent(query);
      
      fetch(tmdbUrl)
        .then(function(response) { return response.json(); })
        .then(function(data) {
          var results = [];
          
          if (data.results) {
            for (var i = 0; i < data.results.length; i++) {
              var item = data.results[i];
              var title = type === "movie" ? (item.title || "") : (item.name || "");
              var year = "";
              
              if (item.release_date) {
                year = item.release_date.split("-")[0];
              } else if (item.first_air_date) {
                year = item.first_air_date.split("-")[0];
              }
              
              results.push({
                title: title,
                year: year,
                img: item.poster_path ? (self.tmdb_image_base + item.poster_path) : "",
                url: self.baseUrl + "/" + type + "/" + item.id
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
  },

  // Get sources for a URL
  get_sources: function(url) {
    var self = this;
    
    return new Promise(function(resolve) {
      var urlParts = url.split("/");
      var type = urlParts[urlParts.length - 2];
      var tmdbId = urlParts[urlParts.length - 1];
      
      if (!tmdbId) {
        resolve([]);
        return;
      }
      
      var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + self.tmdb_api_key;
      
      fetch(tmdbUrl)
        .then(function(response) { return response.json(); })
        .then(function(data) {
          var title = type === "movie" ? (data.title || "") : (data.name || "");
          var searchUrl = self.baseUrl + "/search/?q=" + encodeURIComponent(title);
          
          return fetch(searchUrl, { headers: self.headers })
            .then(function(res) { return res.text(); })
            .then(function(html) {
              var resultPattern = /<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>.*?<div[^>]*>(.*?)<\/div>/g;
              var match;
              var contentUrl = null;
              
              while ((match = resultPattern.exec(html)) !== null) {
                contentUrl = match[1];
                break;
              }
              
              if (!contentUrl) {
                resolve([]);
                return;
              }
              
              var fullContentUrl = contentUrl.indexOf("http") === 0 ? contentUrl : self.baseUrl + contentUrl;
              
              return fetch(fullContentUrl, { headers: self.headers })
                .then(function(res) { return res.text(); })
                .then(function(contentHtml) {
                  var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1;
                  var sources = [];
                  
                  if (isTvShow) {
                    sources = self._extract_tv_sources(contentHtml);
                  } else {
                    sources = self._extract_movie_sources(contentHtml);
                  }
                  
                  resolve(sources);
                });
            });
        })
        .catch(function(error) {
          console.error("Error:", error);
          resolve([]);
        });
    });
  },

  // Extract movie sources
  _extract_movie_sources: function(html) {
    var sources = [];
    var self = this;
    
    var iframePattern = /<iframe.*?src="([^"]+)"/g;
    var match;
    
    while ((match = iframePattern.exec(html)) !== null) {
      var src = match[1];
      if (src.indexOf("http") !== 0) {
        src = src.indexOf("//") === 0 ? "https:" + src : self.baseUrl + src;
      }
      
      sources.push({
        url: src,
        title: "Player",
        type: "iframe"
      });
    }
    
    var videoPattern = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8))"/g;
    var i = 1;
    
    while ((match = videoPattern.exec(html)) !== null) {
      sources.push({
        url: match[1],
        title: "Source " + i++,
        type: "direct"
      });
    }
    
    return sources;
  },

  // Extract TV sources
  _extract_tv_sources: function(html) {
    var sources = [];
    var self = this;
    
    var seasonMatch = html.match(/<button[^>]*>Season\s+(\d+)<\/button>/);
    var season = seasonMatch ? seasonMatch[1] : "1";
    
    var episodePattern = /<a\s+href="([^"]+)"[^>]*>.*?Episode\s+(\d+).*?<\/a>/g;
    var match;
    
    while ((match = episodePattern.exec(html)) !== null) {
      var url = match[1];
      var ep = match[2];
      
      sources.push({
        url: url.indexOf("http") === 0 ? url : self.baseUrl + url,
        title: "Season " + season + " Episode " + ep,
        type: "episode"
      });
    }
    
    return sources;
  },

  // Get episode sources
  get_episode_sources: function(url) {
    var self = this;
    
    return new Promise(function(resolve) {
      fetch(url, { headers: self.headers })
        .then(function(res) { return res.text(); })
        .then(function(html) {
          resolve(self._extract_movie_sources(html));
        })
        .catch(function() {
          resolve([]);
        });
    });
  }
};
