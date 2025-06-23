// Filename: cineby.js

function Cineby() {
  this.name            = "Cineby";
  this.baseUrl         = "https://www.cineby.app";
  // we will use TMDB multi‐search for user queries
  this.searchBaseUrl   = "https://api.themoviedb.org/3/search/multi?api_key=d9956abacedb5b43a16cc4864b26d451&query=%s";
  this.tmdbImageBase   = "https://image.tmdb.org/t/p/w500";
  this.headers         = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                       "AppleWebKit/537.36 (KHTML, like Gecko) " +
                       "Chrome/91.0.4472.124 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}

// ----------------------------------------------------------------//
// search(query, type) => Promise<[{ title, year, img, url, type }]>
// exactly same signature as net3lix.js
// ----------------------------------------------------------------//
Cineby.prototype.search = function(query, type) {
  var self = this;
  // build TMDB URL (multi search)
  var tmdbUrl = this.searchBaseUrl.replace("%s", encodeURIComponent(query));
  return fetch(tmdbUrl)
    .then(function(res) { return res.json(); })
    .then(function(json) {
      var results = [];
      if (json.results && json.results.length) {
        json.results.forEach(function(item) {
          // filter by requested type
          if ((type === "movie" && item.media_type === "movie") ||
              (type === "tv"    && item.media_type === "tv")) {

            var title = (item.media_type === "movie" ? item.title : item.name) || "";
            var year  = "";
            if (item.release_date)     year = item.release_date.slice(0,4);
            else if (item.first_air_date) year = item.first_air_date.slice(0,4);

            // TMDB poster
            var img = item.poster_path
              ? self.tmdbImageBase + item.poster_path
              : "";

            // we will pass a pseudo‐URL into get_sources; we embed TMDB info
            var url = self.baseUrl +
                      "/" + item.media_type +
                      "/" + item.id;

            results.push({
              title: title,
              year:  year,
              img:   img,
              url:   url,
              type:  item.media_type
            });
          }
        });
      }
      return results;
    })
    .catch(function(err) {
      console.error("CINEBY_LOG Search error:", err);
      return [];
    });
};

// ----------------------------------------------------------------//
// get_sources(url) => Promise<[ { url, title, type } ]>
// this closely follows net3lix.js signature
// ----------------------------------------------------------------//
Cineby.prototype.get_sources = function(tmdbUrl) {
  var self = this;
  return new Promise(function(resolve) {
    // tmdbUrl looks like https://www.cineby.app/movie/12345 or /tv/12345
    // extract media type and TMDB id
    var parts = tmdbUrl.split("/");
    var tmdbType = parts[parts.length-2];
    var tmdbId   = parts[parts.length-1];
    if (!tmdbType||!tmdbId) return resolve([]);

    // fetch TMDB details to get the exact title
    var detailsUrl = "https://api.themoviedb.org/3/" +
                     tmdbType + "/" + tmdbId +
                     "?api_key=d9956abacedb5b43a16cc4864b26d451";

    fetch(detailsUrl)
      .then(function(res){ return res.json(); })
      .then(function(details) {
        var title = (tmdbType==="movie" ? details.title : details.name) || "";
        // now search cineby.app for that title
        var cinebySearch = self.baseUrl +
                           "/search/?q=" +
                           encodeURIComponent(title);
        return fetch(cinebySearch, { headers: self.headers })
                  .then(function(r){ return r.text(); });
      })
      .then(function(html) {
        // pick first matching result link
        var m = html.match(/<a\s+href="([^"]+)"[^>]*class="group flex flex-col/);
        if (!m || !m[1]) throw "No cineby result";
        var detailPath = m[1];
        var detailUrl  = /^https?:\/\//.test(detailPath)
                         ? detailPath
                         : self.baseUrl + detailPath;
        return fetch(detailUrl, { headers: self.headers })
                 .then(function(r){ return r.text(); });
      })
      .then(function(detailHtml) {
        // now extract iframe sources
        var sources = [];

        // 1) iframe players
        var iframeRe = /<iframe[^>]+src="([^"]+)"/g;
        var match, idx=1;
        while ((match = iframeRe.exec(detailHtml)) !== null) {
          var src = match[1];
          if (src.indexOf("http")!==0) {
            src = src.indexOf("//")===0
                ? "https:" + src
                : self.baseUrl + src;
          }
          sources.push({
            url:   src,
            title: "Embedded " + (idx++),
            type:  "iframe"
          });
        }

        // 2) direct file URLs in scripts
        var fileRe = /file:\s*"(https?:\/\/[^"]+\.(?:mp4|m3u8))"/g;
        idx = 1;
        while ((match = fileRe.exec(detailHtml)) !== null) {
          sources.push({
            url:   match[1],
            title: "Direct " + (idx++),
            type:  "direct"
          });
        }

        resolve(sources);
      })
      .catch(function(err){
        console.error("CINEBY_LOG get_sources error:", err);
        resolve([]);
      });
  });
};

// ----------------------------------------------------------------//
// get_episode_sources(url) => Promise<[ { url, title, type } ]>
// identical to net3lix.js signature (TV episodes)
// ----------------------------------------------------------------//
Cineby.prototype.get_episode_sources = function(episodeUrl) {
  // cineby puts episodes on the same detail page
  // so we can simply call get_sources on it
  return this.get_sources(episodeUrl);
};

// finally, instantiate the module exactly as net3lix does:
var module = new Cineby();
