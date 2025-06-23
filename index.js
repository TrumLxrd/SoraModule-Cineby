function Cineby() {
  this.name = "Cineby";
  this.baseUrl = "https://www.cineby.app";
  this.tmdb_api_key = "d9956abacedb5b43a16cc4864b26d451";
  this.tmdb_image_base = "https://image.tmdb.org/t/p/w500";
  this.headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  };
}

// Make sure to use THIS syntax exactly - it seems Sora has issues with other forms of function declaration
Cineby.prototype.search = function(query, type) {
  var self = this;
  
  // Critical: Return a standard Promise, avoid any modern Promise handling
  return new Promise(function(resolve, reject) {
    var endpoint = type === "movie" ? "movie" : "tv";
    var url = "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + self.tmdb_api_key + "&query=" + encodeURIComponent(query);
    
    // Use old-school fetch API style
    fetch(url)
      .then(function(response) { 
        return response.json(); 
      })
      .then(function(data) {
        var results = [];
        
        if (data.results) {
          for (var i = 0; i < data.results.length; i++) {
            var item = data.results[i];
            var title = type === "movie" ? item.title : item.name;
            var year = "";
            
            if (type === "movie" && item.release_date) {
              year = item.release_date.split("-")[0];
            } else if (type === "tv" && item.first_air_date) {
              year = item.first_air_date.split("-")[0];
            }
            
            var img = item.poster_path ? self.tmdb_image_base + item.poster_path : "";
            
            results.push({
              title: title,
              url: self.baseUrl + "/" + type + "/" + item.id,
              img: img,
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
    var match = url.match(/\/(movie|tv)\/(\d+)$/);
    if (!match) {
      resolve([]);
      return;
    }
    
    var type = match[1];
    var id = match[2];
    
    fetch("https://api.themoviedb.org/3/" + type + "/" + id + "?api_key=" + self.tmdb_api_key)
      .then(function(response) { return response.json(); })
      .then(function(details) {
        var title = type === "movie" ? details.title : details.name;
        
        fetch(self.baseUrl + "/search/?q=" + encodeURIComponent(title), { headers: self.headers })
          .then(function(response) { return response.text(); })
          .then(function(html) {
            // Find first search result
            var linkMatch = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>/);
            
            if (!linkMatch) {
              resolve([]);
              return;
            }
            
            var contentUrl = linkMatch[1];
            var fullUrl = contentUrl.indexOf("http") === 0 ? contentUrl : self.baseUrl + contentUrl;
            
            fetch(fullUrl, { headers: self.headers })
              .then(function(response) { return response.text(); })
              .then(function(contentHtml) {
                var isTvShow = contentHtml.indexOf("role=\"tablist\"") !== -1;
                
                if (isTvShow) {
                  resolve(self._extract_tv_sources(contentHtml, fullUrl));
                } else {
                  resolve(self._extract_movie_sources(contentHtml, fullUrl));
                }
              })
              .catch(function() { resolve([]); });
          })
          .catch(function() { resolve([]); });
      })
      .catch(function() { resolve([]); });
  });
};

Cineby.prototype._extract_movie_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  // Find iframe sources
  var iframeRegex = /<iframe[^>]*src="([^"]+)"/g;
  var match;
  
  while ((match = iframeRegex.exec(html)) !== null) {
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
  
  // Find direct sources
  var fileRegex = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8))"/g;
  var count = 1;
  
  while ((match = fileRegex.exec(html)) !== null) {
    sources.push({
      url: match[1],
      title: "Source " + count++,
      type: "direct"
    });
  }
  
  return sources;
};

Cineby.prototype._extract_tv_sources = function(html, url) {
  var sources = [];
  var self = this;
  
  var seasonMatch = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
  var season = seasonMatch ? seasonMatch[1] : "1";
  
  var episodeRegex = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
  var match;
  
  while ((match = episodeRegex.exec(html)) !== null) {
    var episodeUrl = match[1];
    var episodeNum = match[2];
    
    var fullUrl = episodeUrl.indexOf("http") === 0 ? episodeUrl : self.baseUrl + episodeUrl;
    
    sources.push({
      url: fullUrl,
      title: "Season " + season + " Episode " + episodeNum,
      type: "episode"
    });
  }
  
  return sources;
};

Cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    fetch(url, { headers: self.headers })
      .then(function(response) { return response.text(); })
      .then(function(html) {
        resolve(self._extract_movie_sources(html, url));
      })
      .catch(function() { resolve([]); });
  });
};

var module = new Cineby();
export default module;
