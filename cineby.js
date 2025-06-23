// ------ cineby.js ------

function Cineby() {
  this.name           = "Cineby";
  this.baseUrl        = "https://www.cineby.app";
  this.searchBaseUrl  = this.baseUrl + "/search/?q=";
  this.tmdbApiKey     = "d9956abacedb5b43a16cc4864b26d451";
  this.tmdbBaseUrl    = "https://api.themoviedb.org/3";
  this.tmdbImageBase  = "https://image.tmdb.org/t/p/w500";
  this.headers        = { "User-Agent": navigator.userAgent };
}

// 1. SEARCH – returns Promise<[ { title, year, img, url, type } ]>
Cineby.prototype.search = function(query, type) {
  var self = this;
  var endpoint = (type === "movie" ? "movie" : "tv");
  var url = self.tmdbBaseUrl + "/search/" + endpoint
          + "?api_key=" + self.tmdbApiKey
          + "&query="  + encodeURIComponent(query);

  return fetch(url)
    .then(function(r){ return r.json() })
    .then(function(json){
      var out = [];
      if (Array.isArray(json.results)) {
        json.results.forEach(function(item){
          var title = (type==="movie"? item.title : item.name) || "";
          var year  = (item.release_date || item.first_air_date || "").substr(0,4);
          var img   = item.poster_path
                    ? self.tmdbImageBase + item.poster_path
                    : "";
          // URL format for get_sources
          var url_  = self.baseUrl + "/" + type + "/" + item.id;
          out.push({ title: title, year: year, img: img, url: url_, type: type });
        });
      }
      return out;
    })
    .catch(function(){
      return [];
    });
};

// 2. GET_SOURCES – returns Promise<[ { url, title, type } ]> for a movie or TV show page
Cineby.prototype.get_sources = function(url) {
  var self = this;
  // Extract TMDB type & id from the URL we built in search()
  var m = url.match(/\/(movie|tv)\/(\d+)$/);
  if (!m) return Promise.resolve([]);

  var type  = m[1], tmdbId = m[2];
  // 2.1 fetch TMDB details to get exact title
  var detailsUrl = self.tmdbBaseUrl + "/" + type + "/" + tmdbId
                 + "?api_key=" + self.tmdbApiKey;

  return fetch(detailsUrl)
    .then(function(r){ return r.json() })
    .then(function(info){
      var title = (type==="movie"? info.title : info.name) || "";
      // 2.2 search Cineby.app by title
      var cinebySearch = self.searchBaseUrl + encodeURIComponent(title);
      return fetch(cinebySearch, { headers: self.headers });
    })
    .then(function(r){ return r.text() })
    .then(function(html){
      // find first result link
      var m2 = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col/);
      if (!m2) throw "no-link";
      var pageUrl = m2[1].startsWith("http")
                  ? m2[1]
                  : self.baseUrl + m2[1];
      return fetch(pageUrl, { headers: self.headers });
    })
    .then(function(r){ return r.text() })
    .then(function(html){
      // decide movie vs TV
      var isTv = /role="tablist"/.test(html) && /Season/.test(html);
      return isTv
        ? self._extract_tv_sources(html)
        : self._extract_movie_sources(html);
    })
    .catch(function(){
      return [];
    });
};

// 3. GET_EPISODE_SOURCES – for a single episode URL, same extraction as a movie
Cineby.prototype.get_episode_sources = function(url) {
  var self = this;
  return fetch(url, { headers: self.headers })
    .then(function(r){ return r.text() })
    .then(function(html){
      return self._extract_movie_sources(html);
    })
    .catch(function(){
      return [];
    });
};

// 4. GET_SUBTITLES – Sora requires this stub even if unused
Cineby.prototype.get_subtitles = function(url) {
  return Promise.resolve([]);
};

// ----- internal helpers (not counted as public) -----
Cineby.prototype._extract_movie_sources = function(html) {
  var out = [], m, i;
  // iframe players
  var reIframe = /<iframe[^>]*src="([^"]+)"/g;
  while ((m = reIframe.exec(html))) {
    var src = m[1];
    if (!/^https?:\/\//.test(src)) {
      src = src.indexOf("//")===0 ? "https:" + src : this.baseUrl + src;
    }
    out.push({ url: src, title: "Player", type: "iframe" });
  }
  // direct files
  var reFile = /file:\s*"([^"]+\.(?:mp4|m3u8))"/g;
  i = 1;
  while ((m = reFile.exec(html))) {
    out.push({ url: m[1], title: "Source " + (i++), type: "direct" });
  }
  return out;
};

Cineby.prototype._extract_tv_sources = function(html) {
  var out = [], m;
  var seasonMatch = html.match(/<button[^>]*bg-gray-700[^>]*>Season\s+(\d+)<\/button>/);
  var season = seasonMatch ? seasonMatch[1] : "1";
  var reEp = /<a\s+href="([^"]+)"[^>]*>[^<]*Episode\s+(\d+)[^<]*<\/a>/g;
  while ((m = reEp.exec(html))) {
    var epUrl = m[1].startsWith("http") ? m[1] : this.baseUrl + m[1];
    out.push({
      url: epUrl,
      title: "S" + season + " E" + m[2],
      type: "episode"
    });
  }
  return out;
};

// instantiate
var module = new Cineby();
