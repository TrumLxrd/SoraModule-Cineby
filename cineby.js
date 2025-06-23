// Filename: cineby.js

function cineby() {
  this.name           = "Cineby";
  this.baseUrl        = "https://www.cineby.app";
  this.search_url     = this.baseUrl + "/search/";
  this.tmdbApiKey     = "d9956abacedb5b43a16cc4864b26d451";
  this.tmdbBaseUrl    = "https://api.themoviedb.org/3";
  this.tmdbImageUrl   = "https://image.tmdb.org/t/p/w500";
  // hard‐coded headers (no navigator.*)
  this.headers        = {
    "User-Agent":      "Mozilla/5.0 (compatible)",
    "Accept":          "text/html,application/xhtml+xml"
  };
}

// SEARCH via TMDB
cineby.prototype.search = function(query, type) {
  var self     = this;
  var endpoint = (type === "movie") ? "movie" : "tv";
  var url      = self.tmdbBaseUrl
               + "/search/" + endpoint
               + "?api_key=" + self.tmdbApiKey
               + "&query="    + encodeURIComponent(query);

  return fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(json){
      var results = [];
      if (json && json.results) {
        for (var i = 0; i < json.results.length; i++) {
          var item = json.results[i];
          var title = (type === "movie") ? item.title : item.name;
          var year  = "";
          if      (type==="movie" && item.release_date)  year = item.release_date.split("-")[0];
          else if (type==="tv"    && item.first_air_date) year = item.first_air_date.split("-")[0];
          var img = item.poster_path ? self.tmdbImageUrl + item.poster_path : "";

          results.push({
            title: title,
            year:  year,
            img:   img,
            // we’ll use /tmdb/type/id as a “proxy URL”
            url:   self.baseUrl + "/tmdb/" + type + "/" + item.id,
            type:  type
          });
        }
      }
      return results;
    })
    .catch(function(e){
      console.error("Cineby.search error:", e);
      return [];
    });
};

// GET SOURCES (movie or TV) from a “/tmdb/type/id” URL
cineby.prototype.get_sources = function(proxyUrl) {
  var self     = this;
  // proxyUrl is something like "https://…/tmdb/movie/12345"
  // extract type/id
  var parts  = proxyUrl.split("/");
  var type   = parts[parts.length - 2];
  var tmdbId = parts[parts.length - 1];

  // 1) fetch details from TMDB
  return fetch(self.tmdbBaseUrl + "/" + type + "/" + tmdbId + "?api_key=" + self.tmdbApiKey)
    .then(function(r){ return r.json(); })
    // 2) use the official title to search Cineby
    .then(function(details){
      var title = (type==="movie") ? details.title : details.name;
      return fetch(self.search_url + "?q=" + encodeURIComponent(title), { headers: self.headers });
    })
    .then(function(r){ return r.text(); })
    // 3) find the first Cineby content link
    .then(function(html){
      var m = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col[^>]*>/);
      if (!m || !m[1]) return Promise.resolve([]);
      var contentUrl = m[1].startsWith("http") ? m[1] : self.baseUrl + m[1];
      return fetch(contentUrl, { headers: self.headers }).then(function(r){ return r.text(); });
    })
    // 4) on the content page, decide movie vs TV and extract sources
    .then(function(html){
      var isTv = /role="tablist".*?Season/.test(html);
      return isTv
        ? self._extract_tv_sources(html)
        : self._extract_movie_sources(html);
    })
    .catch(function(e){
      console.error("Cineby.get_sources error:", e);
      return [];
    });
};

// EXTRACT MOVIE SOURCES
cineby.prototype._extract_movie_sources = function(html) {
  var sources = [], m, idx = 1, self = this;
  // iframes
  var iframeRe = /<iframe[^>]*src="([^"]+)"/g;
  while ( (m = iframeRe.exec(html)) !== null ) {
    var src = m[1];
    if (!/^https?:\/\//.test(src)) {
      src = src.startsWith("//") ? "https:" + src : this.baseUrl + src;
    }
    sources.push({ url: src, title: "Player", type: "iframe" });
  }
  // direct files
  var fileRe = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8))"/g;
  while ( (m = fileRe.exec(html)) !== null ) {
    sources.push({ url: m[1], title: "Source " + (idx++), type: "direct" });
  }
  return sources;
};

// EXTRACT TV EPISODES
cineby.prototype._extract_tv_sources = function(html) {
  var sources = [], m, self = this;
  // find active season
  var sm = html.match(/<button[^>]*bg-gray-700[^>]*>Season\s+(\d+)<\/button>/);
  var season = sm ? sm[1] : "1";
  // episode list
  var epRe = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)/g;
  while ((m = epRe.exec(html)) !== null) {
    var epUrl = m[1].startsWith("http") ? m[1] : this.baseUrl + m[1];
    sources.push({
      url:   epUrl,
      title: "Season " + season + " Episode " + m[2],
      type:  "episode"
    });
  }
  return sources;
};

// GET EPISODE SOURCES (same as movie extraction)
cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  return fetch(url, { headers: self.headers })
    .then(function(r){ return r.text(); })
    .then(function(html){ return self._extract_movie_sources(html); })
    .catch(function(){ return []; });
};

// finally, Sora picks up this global variable
var module = new cineby();
