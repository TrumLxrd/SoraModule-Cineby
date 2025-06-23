// Filename: cineby.js

// 1) Constructor
function cineby() {
  this.name           = "Cineby";
  this.baseUrl        = "https://www.cineby.app";
  this.searchPath     = "/search/";
  this.tmdbApiKey     = "d9956abacedb5b43a16cc4864b26d451";
  this.tmdbBaseUrl    = "https://api.themoviedb.org/3";
  this.tmdbImageUrl   = "https://image.tmdb.org/t/p/w500";
  this.headers        = {
    "User-Agent":       "Mozilla/5.0",
    "Accept":           "text/html,application/xhtml+xml",
    "Accept-Language":  "en-US,en;q=0.5"
  };
}

// 2) Search – only TMDB, returns an array of {title,year,img,url,type}
cineby.prototype.search = function(query, type) {
  var self     = this;
  var endpoint = (type === "movie") ? "movie" : "tv";
  var url      = this.tmdbBaseUrl + "/search/" + endpoint +
                 "?api_key=" + this.tmdbApiKey +
                 "&query=" + encodeURIComponent(query);

  console.log("CINEBY_LOG: Searching TMDB for", query, "as", type);
  return fetch(url)
    .then(function(res){ return res.json(); })
    .then(function(json){
      var results = [];
      if (json && json.results) {
        for (var i=0; i<json.results.length; i++) {
          var itm = json.results[i];
          var title = (type==="movie") ? itm.title : itm.name;
          var year  = "";
          if (type==="movie" && itm.release_date) {
            year = itm.release_date.split("-")[0];
          }
          else if (type==="tv" && itm.first_air_date) {
            year = itm.first_air_date.split("-")[0];
          }
          var poster = itm.poster_path
                       ? self.tmdbImageUrl + itm.poster_path
                       : "";

          results.push({
            title: title,
            year:  year,
            img:   poster,
            // use a synthetic URL to carry tmdb info through Sora
            url:   self.baseUrl + "/tmdb/" + type + "/" + itm.id,
            type:  type
          });
        }
      }
      console.log("CINEBY_LOG: TMDB returned", results.length, "items");
      return results;
    })
    .catch(function(err){
      console.error("CINEBY_LOG: search error", err);
      return [];
    });
};

// 3) Get sources – parse our synthetic URL, fetch TMDB details, then find the actual cineby.app page 
cineby.prototype.get_sources = function(syntheticUrl) {
  var self = this;
  console.log("CINEBY_LOG: get_sources for", syntheticUrl);

  // 3.1 extract type & tmdbId from syntheticUrl
  var parts   = syntheticUrl.split("/");
  var type    = parts[parts.length-2];
  var tmdbId  = parts[parts.length-1];

  if (!type || !tmdbId) {
    console.warn("CINEBY_LOG: invalid URL", syntheticUrl);
    return Promise.resolve([]);
  }

  // 3.2 fetch TMDB details to get the real title
  var detailsUrl = this.tmdbBaseUrl + "/" + type + "/" + tmdbId +
                   "?api_key=" + this.tmdbApiKey;

  return fetch(detailsUrl)
    .then(function(res){ return res.json(); })
    .then(function(info){
      var title = (type==="movie") ? info.title : info.name;
      console.log("CINEBY_LOG: TMDB details title=", title);
      // 3.3 search on cineby.app
      var cinebySearch = self.baseUrl + self.searchPath +
                         "?q=" + encodeURIComponent(title);
      return fetch(cinebySearch, { headers: self.headers });
    })
    .then(function(res){ return res.text(); })
    .then(function(html){
      // 3.4 grab the first matching link
      var m = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col/);
      if (!m || !m[1]) {
        console.warn("CINEBY_LOG: no cineby match");
        return [];
      }
      var href = m[1];
      var full = href.indexOf("http")===0 ? href : self.baseUrl + href;
      console.log("CINEBY_LOG: found content page:", full);
      return fetch(full, { headers: self.headers })
        .then(function(r){ return r.text(); });
    })
    .then(function(contentHtml){
      if (!contentHtml) return [];
      // detect TV vs movie
      var isTv = /role="tablist"/.test(contentHtml) &&
                 /Season/.test(contentHtml);
      if (isTv) {
        return self._extract_tv_sources(contentHtml);
      } else {
        return self._extract_movie_sources(contentHtml);
      }
    })
    .catch(function(err){
      console.error("CINEBY_LOG: get_sources error", err);
      return [];
    });
};

// 4) Extract direct & iframe sources from a movie page
cineby.prototype._extract_movie_sources = function(html) {
  var sources = [], match;

  // 4.1 iframes
  var iframeRe = /<iframe[^>]*src="([^"]+)"/g;
  while ((match = iframeRe.exec(html)) !== null) {
    var src = match[1];
    if (src.indexOf("http")!==0) {
      src = src.indexOf("//")===0
            ? "https:" + src
            : this.baseUrl + src;
    }
    sources.push({ url: src, title:"Iframe", type:"iframe" });
  }

  // 4.2 direct files
  var fileRe = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8))"/g;
  var idx = 1;
  while ((match = fileRe.exec(html)) !== null) {
    sources.push({
      url:   match[1],
      title: "Source " + (idx++),
      type:  "direct"
    });
  }

  console.log("CINEBY_LOG: movie sources found:", sources.length);
  return sources;
};

// 5) Extract TV episode sources
cineby.prototype._extract_tv_sources = function(html) {
  var sources = [], match;

  // find active season
  var sm = html.match(/<button[^>]*class="[^"]*bg-gray-700[^"]*"[^>]*>Season\s+(\d+)<\/button>/);
  var season = sm && sm[1] ? sm[1] : "1";

  // find episodes
  var epRe = /<a\s+href="([^"]+)"[^>]*>.*?<span[^>]*>Episode\s+(\d+)[^<]*<\/span>/g;
  while ((match = epRe.exec(html)) !== null) {
    var href = match[1], num = match[2];
    var full = href.indexOf("http")===0 ? href : this.baseUrl + href;
    sources.push({
      url:   full,
      title: "S" + season + "E" + num,
      type:  "episode"
    });
  }

  console.log("CINEBY_LOG: tv episodes found:", sources.length);
  return sources;
};

// 6) Extract sources for a single episode page (reuse movie logic)
cineby.prototype.get_episode_sources = function(url) {
  console.log("CINEBY_LOG: get_episode_sources for", url);
  return fetch(url, { headers: this.headers })
    .then(function(r){ return r.text(); })
    .then(function(html){ return this._extract_movie_sources(html); }.bind(this))
    .catch(function(){ return []; });
};

// 7) Export
var module = new cineby();
