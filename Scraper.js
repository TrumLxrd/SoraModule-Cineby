// Cineby.app Sora Module
// Version: 1.0.0

function searchResults(html) {
    try {
        const results = [];
        
        // Multiple selectors to catch different layouts
        const selectors = [
            '.movie-card',
            '.film-item',
            '.search-result',
            '.movie-item',
            'article',
            '.card'
        ];
        
        let items = [];
        for (const selector of selectors) {
            const elements = html.querySelectorAll(selector);
            if (elements.length > 0) {
                items = Array.from(elements);
                break;
            }
        }
        
        // Fallback: look for any element with movie-related attributes
        if (items.length === 0) {
            items = Array.from(html.querySelectorAll('[data-movie], [data-film], a[href*="movie"], a[href*="film"]'));
        }
        
        for (const item of items.slice(0, 20)) {
            try {
                let title = '';
                let image = '';
                let link = '';
                
                // Extract title
                const titleSelectors = [
                    '.title', '.movie-title', '.film-title', 
                    'h1', 'h2', 'h3', 'h4', 
                    '[data-title]', '.name'
                ];
                
                for (const sel of titleSelectors) {
                    const titleEl = item.querySelector(sel);
                    if (titleEl) {
                        title = titleEl.textContent?.trim() || titleEl.getAttribute('data-title') || '';
                        if (title) break;
                    }
                }
                
                // Fallback title extraction
                if (!title) {
                    title = item.textContent?.trim().split('\n')[0] || '';
                }
                
                // Extract image
                const imgSelectors = [
                    'img', '.poster img', '.thumbnail img', 
                    '.image img', '[data-src]'
                ];
                
                for (const sel of imgSelectors) {
                    const imgEl = item.querySelector(sel);
                    if (imgEl) {
                        image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy') || '';
                        if (image) break;
                    }
                }
                
                // Extract link
                const linkEl = item.querySelector('a') || (item.tagName === 'A' ? item : null);
                if (linkEl) {
                    link = linkEl.href || linkEl.getAttribute('href') || '';
                }
                
                // Clean and validate data
                if (title && title.length > 2) {
                    // Make relative URLs absolute
                    if (link && !link.startsWith('http')) {
                        link = link.startsWith('/') ? `https://www.cineby.app${link}` : `https://www.cineby.app/${link}`;
                    }
                    
                    if (image && !image.startsWith('http')) {
                        image = image.startsWith('/') ? `https://www.cineby.app${image}` : `https://www.cineby.app/${image}`;
                    }
                    
                    results.push({
                        title: title.substring(0, 100), // Limit title length
                        image: image,
                        link: link
                    });
                }
            } catch (e) {
                console.log('Error processing item:', e);
                continue;
            }
        }
        
        console.log(`Found ${results.length} search results`);
        return results;
        
    } catch (error) {
        console.error('Search results extraction error:', error);
        return [];
    }
}

function extractDetails(html) {
    try {
        let title = '';
        let description = '';
        let image = '';
        let year = '';
        let rating = '';
        let genre = '';
        
        // Extract title
        const titleSelectors = [
            'h1', '.movie-title', '.film-title', 
            '.title', '[data-title]', 'title'
        ];
        
        for (const sel of titleSelectors) {
            const el = html.querySelector(sel);
            if (el) {
                title = el.textContent?.trim() || '';
                if (title && title !== 'Cineby') break;
            }
        }
        
        // Extract description
        const descSelectors = [
            '.description', '.synopsis', '.plot', 
            '.overview', '.summary', '[data-description]',
            'meta[name="description"]'
        ];
        
        for (const sel of descSelectors) {
            const el = html.querySelector(sel);
            if (el) {
                if (el.tagName === 'META') {
                    description = el.getAttribute('content') || '';
                } else {
                    description = el.textContent?.trim() || '';
                }
                if (description && description.length > 20) break;
            }
        }
        
        // Extract image
        const imgSelectors = [
            '.poster img', '.movie-poster img', 
            '.thumbnail img', '.cover img',
            'meta[property="og:image"]'
        ];
        
        for (const sel of imgSelectors) {
            const el = html.querySelector(sel);
            if (el) {
                if (el.tagName === 'META') {
                    image = el.getAttribute('content') || '';
                } else {
                    image = el.src || el.getAttribute('data-src') || '';
                }
                if (image) break;
            }
        }
        
        // Extract year using regex
        const yearRegex = /\b(19|20)\d{2}\b/g;
        const bodyText = html.body?.textContent || '';
        const yearMatches = bodyText.match(yearRegex);
        if (yearMatches) {
            year = yearMatches[yearMatches.length - 1]; // Get the last/most recent year
        }
        
        // Extract rating
        const ratingRegex = /(\d+(?:\.\d+)?)\s*\/\s*10|\b(\d+(?:\.\d+)?)\s*stars?/gi;
        const ratingMatch = bodyText.match(ratingRegex);
        if (ratingMatch) {
            rating = ratingMatch[0];
        }
        
        // Extract genre
        const genreKeywords = ['action', 'comedy', 'drama', 'horror', 'thriller', 'romance', 'sci-fi', 'fantasy', 'adventure', 'crime'];
        const lowerText = bodyText.toLowerCase();
        const foundGenres = genreKeywords.filter(g => lowerText.includes(g));
        if (foundGenres.length > 0) {
            genre = foundGenres.slice(0, 3).join(', ');
        }
        
        // Make image URL absolute
        if (image && !image.startsWith('http')) {
            image = image.startsWith('/') ? `https://www.cineby.app${image}` : `https://www.cineby.app/${image}`;
        }
        
        const details = {
            title: title || 'Unknown Title',
            description: description || 'No description available',
            image: image,
            year: year,
            rating: rating,
            genre: genre
        };
        
        console.log('Extracted details:', details);
        return details;
        
    } catch (error) {
        console.error('Details extraction error:', error);
        return {
            title: 'Unknown Title',
            description: 'No description available',
            image: '',
            year: '',
            rating: '',
            genre: ''
        };
    }
}

function extractEpisodes(html) {
    try {
        const episodes = [];
        
        // Look for episode links
        const episodeSelectors = [
            '.episode', '.ep', '[data-episode]',
            'a[href*="episode"]', 'a[href*="ep"]'
        ];
        
        let episodeElements = [];
        for (const sel of episodeSelectors) {
            const elements = html.querySelectorAll(sel);
            if (elements.length > 0) {
                episodeElements = Array.from(elements);
                break;
            }
        }
        
        if (episodeElements.length > 0) {
            // Process actual episodes
            episodeElements.forEach((el, index) => {
                const link = el.href || el.querySelector('a')?.href || '';
                const episodeNum = el.getAttribute('data-episode') || 
                                 el.textContent?.match(/\d+/)?.[0] || 
                                 (index + 1).toString();
                
                if (link) {
                    episodes.push({
                        episode: parseInt(episodeNum),
                        link: link.startsWith('http') ? link : `https://www.cineby.app${link}`
                    });
                }
            });
        } else {
            // Default: treat as single movie/episode
            episodes.push({
                episode: 1,
                link: window.location.href
            });
        }
        
        console.log(`Found ${episodes.length} episodes`);
        return episodes;
        
    } catch (error) {
        console.error('Episodes extraction error:', error);
        return [{
            episode: 1,
            link: window.location.href
        }];
    }
}

function extractStreamUrl(html) {
    try {
        let streamUrl = '';
        
        // Method 1: Look for video sources
        const videoSources = html.querySelectorAll('video source, source');
        for (const source of videoSources) {
            const src = source.src || source.getAttribute('data-src');
            if (src && (src.includes('.mp4') || src.includes('.m3u8'))) {
                streamUrl = src;
                break;
            }
        }
        
        // Method 2: Look for video elements
        if (!streamUrl) {
            const videos = html.querySelectorAll('video');
            for (const video of videos) {
                const src = video.src || video.getAttribute('data-src');
                if (src && (src.includes('.mp4') || src.includes('.m3u8'))) {
                    streamUrl = src;
                    break;
                }
            }
        }
        
        // Method 3: Look for iframe sources
        if (!streamUrl) {
            const iframes = html.querySelectorAll('iframe');
            for (const iframe of iframes) {
                const src = iframe.src;
                if (src && (src.includes('player') || src.includes('embed'))) {
                    streamUrl = src;
                    break;
                }
            }
        }
        
        // Method 4: Search in script tags for video URLs
        if (!streamUrl) {
            const scripts = html.querySelectorAll('script');
            const urlRegex = /(https?:\/\/[^\s"']+\.(?:mp4|m3u8|mkv|avi))/gi;
            
            for (const script of scripts) {
                const scriptContent = script.textContent || '';
                const matches = scriptContent.match(urlRegex);
                if (matches && matches.length > 0) {
                    streamUrl = matches[0];
                    break;
                }
            }
        }
        
        // Method 5: Look for common variable names in scripts
        if (!streamUrl) {
            const scripts = html.querySelectorAll('script');
            const varRegex = /(?:videoUrl|streamUrl|playerUrl|source)\s*[:=]\s*["']([^"']+)["']/gi;
            
            for (const script of scripts) {
                const scriptContent = script.textContent || '';
                const match = varRegex.exec(scriptContent);
                if (match && match[1]) {
                    streamUrl = match[1];
                    break;
                }
            }
        }
        
        // Make URL absolute if needed
        if (streamUrl && !streamUrl.startsWith('http')) {
            streamUrl = streamUrl.startsWith('/') ? `https://www.cineby.app${streamUrl}` : `https://www.cineby.app/${streamUrl}`;
        }
        
        console.log('Extracted stream URL:', streamUrl);
        return streamUrl;
        
    } catch (error) {
        console.error('Stream URL extraction error:', error);
        return '';
    }
}

// Helper function for debugging
function debugInfo() {
    return {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };
}
