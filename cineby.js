// Filename: cineby.js

function cineby() {
  this.name = "Cineby";
  this.baseUrl = "https://www.cineby.app";
  this.searchUrl = this.baseUrl + "/search/";
  this.tmdbApiKey = "d9956abacedb5b43a16cc4864b26d451";
  this.tmdbBaseUrl = "https://api.themoviedb.org/3";
  this.tmdbImageUrl = "https://image.tmdb.org/t/p/w500";
  this.headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  };
}

cineby.prototype.search = function(query, type) {
  var self = this;
  var endpoint = type === "movie" ? "movie" : "tv";
  var url = self.tmdbBaseUrl + "/search/" + endpoint +
            "?api_key=" + self.tmdbApiKey +
            "&query=" + encodeURIComponent(query);

  return fetch(url)
    .then(function(response) {
      return response.json();
    })
    .then(function(json) {
      var results = [];
      if (json && json.results) {
        for (var i = 0; i < json.results.length; i++) {
          var item = json.results[i];
          var title = type === "movie" ? item.title : item.name;
          var year = "";
          if (type === "movie" && item.release_date) {
            year = item.release_date.split("-")[0];
          } else if (type === "tv" && item.first_air_date) {
            year = item.first_air_date.split("-")[0];
          }
          var img = item.poster_path ? self.tmdbImageUrl + item.poster_path : "";

          results.push({
            title: title,
            year: year,
            img: img,
            url: self.baseUrl + "/tmdb/" + type + "/" + item.id,
            type: type
          });
        }
      }
      return results;
    })
    .catch(function(err) {
      console.error("Cineby Search Error:", err);
      return [];
    });
};

cineby.prototype.get_sources = function(url) {
  var self = this;
  // URL format: https://.../tmdb/{type}/{id}
  var parts = url.split("/");
  var tmdbIndex = parts.indexOf("tmdb");
  if (tmdbIndex < 0 || parts.length < tmdbIndex + 3) {
    return Promise.resolve([]);
  }
  var type = parts[tmdbIndex + 1];
  var tmdbId = parts[tmdbIndex + 2];

  var detailsUrl = self.tmdbBaseUrl + "/" + type + "/" + tmdbId +
                   "?api_key=" + self.tmdbApiKey;

  return fetch(detailsUrl)
    .then(function(response) {
      return response.json();
    })
    .then(function(details) {
      var title = type === "movie" ? details.title : details.name;
      var searchUrl = self.searchUrl + "?q=" + encodeURIComponent(title);
      return fetch(searchUrl, { headers: self.headers });
    })
    .then(function(response) {
      return response.text();
    })
    .then(function(html) {
      // find first content link
      var m = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col/);
      if (!m || !m[1]) return [];
      var contentPath = m[1];
      var fullContentUrl = contentPath.indexOf("http") === 0
        ? contentPath
        : self.baseUrl + contentPath;
      return fetch(fullContentUrl, { headers: self.headers });
    })
    .then(function(response) {
      return response.text();
    })
    .then(function(pageHtml) {
      var isTv = pageHtml.indexOf('role="tablist"') !== -1;
      if (isTv) {
        return self._extract_tv_sources(pageHtml);
      } else {
        return self._extract_movie_sources(pageHtml);
      }
    })
    .catch(function(err) {
      console.error("Cineby Get Sources Error:", err);
      return [];
    });
};

cineby.prototype._extract_movie_sources = function(html) {
  var sources = [];
  var match;
  var iframeRe = /<iframe.*?src="([^"]+)"/g;
  while ((match = iframeRe.exec(html)) !== null) {
    var src = match[1];
    if (src.indexOf("http") !== 0) {
      src = src.indexOf("//") === 0
        ? "https:" + src
        : this.baseUrl + src;
    }
    sources.push({ url: src, title: "Iframe Source", type: "iframe" });
  }

  var fileRe = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8|mkv))"/g;
  var count = 1;
  while ((match = fileRe.exec(html)) !== null) {
    sources.push({
      url: match[1],
      title: "Source " + (count++),
      type: "direct"
    });
  }

  return sources;
};

cineby.prototype._extract_tv_sources = function(html) {
  var sources = [];
  var seasonMatch = html.match(
    /<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/
  );
  var season = seasonMatch && seasonMatch[1] ? seasonMatch[1] : "1";

  var epRe = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
  var match;
  while ((match = epRe.exec(html)) !== null) {
    var epUrl = match[1];
    var epNum = match[2];
    var fullUrl = epUrl.indexOf("http") === 0
      ? epUrl
      : this.baseUrl + epUrl;
    sources.push({
      url: fullUrl,
      title: "Season " + season + " Episode " + epNum,
      type: "episode"
    });
  }

  return sources;
};

cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  return fetch(url, { headers: this.headers })
    .then(function(response) {
      return response.text();
    })
    .then(function(html) {
      return self._extract_movie_sources(html);
    })
    .catch(function(err) {
      console.error("Cineby Get Episode Sources Error:", err);
      return [];
    });
};

// instantiate module
var module = new cineby();
