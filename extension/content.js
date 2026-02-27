(async function () {
    // Prevent multiple initializations (e.g. if popup injects script again)
    if (window.__scraperInitialized) {
        if (typeof window.extractAndSendData === 'function') {
            console.log("Web Data Scraper: Manual extraction triggered.");
            return await window.extractAndSendData();
        }
        return { success: true, message: "Already initialized." };
    }

    try {
        const currentDomain = window.location.hostname;

        // Wait for chrome.storage to tell us if this domain is enabled
        const isActive = await new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['active_domains'], function (result) {
                    const activeDomains = result.active_domains || [];
                    resolve(activeDomains.includes(currentDomain));
                });
            } else {
                resolve(false);
            }
        });

        if (!isActive) {
            console.log("Web Data Scraper: auto-extraction not enabled for " + currentDomain);
            return { success: false, error: "Auto-extraction is not enabled for this site yet. Click the extension popup to start." };
        }

        // Mark as initialized so we don't attach multiple observers
        window.__scraperInitialized = true;

        async function extractAndSendData() {
            try {
                // 1. Extract Data from DOM
                const url = window.location.href;
                const title = document.title;

                // Extract headings (h1, h2, h3)
                const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                    .map(h => h.innerText.trim())
                    .filter(text => text.length > 0);

                // Deep clone the body so we can modify it without breaking the live page
                const clonedBody = document.body.cloneNode(true);

                // Remove unwanted elements: nav, footer, header, scripts, styles, links
                const elementsToRemove = clonedBody.querySelectorAll('nav, footer, header, script, style, a, noscript, iframe');
                elementsToRemove.forEach(el => el.remove());

                // Extract the remaining text content, split by newlines, and clean up
                let rawText = clonedBody.innerText || clonedBody.textContent;
                let contentArray = rawText.split('\n')
                    .map(text => text.replace(/\s+/g, ' ').trim())
                    .filter(text => text.length > 0);

                // Extract server metrics from the array
                let metrics = {
                    availability: null,
                    cpu: null,
                    memory: null,
                    disk: null,
                    downtimes: null,
                    hostname: null,
                    ip_address: null,
                    os_name: null,
                    os_version: null,
                    kernel_version: null,
                    processor: null,
                    ram_size: null,
                    uptime: null
                };

                for (let i = 0; i < contentArray.length; i++) {
                    let val = contentArray[i];

                    // Look-back for format: "100" "%" "Availability"
                    if (val === "Availability" && i >= 2) metrics.availability = contentArray[i - 2] + contentArray[i - 1];
                    if (val === "CPU" && i >= 2 && contentArray[i - 1] === "%" && !metrics.cpu) metrics.cpu = contentArray[i - 2] + contentArray[i - 1];
                    if (val === "Memory" && i >= 2 && contentArray[i - 1] === "%" && !metrics.memory) metrics.memory = contentArray[i - 2] + contentArray[i - 1];
                    if (val === "Disk" && i >= 2 && contentArray[i - 1] === "%" && !metrics.disk) metrics.disk = contentArray[i - 2] + contentArray[i - 1];
                    if (val === "Downtimes" && i >= 1 && !metrics.downtimes) metrics.downtimes = contentArray[i - 1];

                    // Look-ahead for keys
                    if (val === "Hostname" && !metrics.hostname) metrics.hostname = contentArray[i + 1];
                    if (val === "IP Address" && !metrics.ip_address) metrics.ip_address = contentArray[i + 1];
                    if (val === "OS Name" && !metrics.os_name) metrics.os_name = contentArray[i + 1];
                    if (val === "OS Version" && !metrics.os_version) metrics.os_version = contentArray[i + 1];
                    if (val === "Kernel Version" && !metrics.kernel_version) metrics.kernel_version = contentArray[i + 1];
                    if (val === "Processor" && !metrics.processor) metrics.processor = contentArray[i + 1];
                    if (val === "RAM Size" && !metrics.ram_size) metrics.ram_size = contentArray[i + 1];

                    // Uptime is on a single line usually
                    if (val.startsWith("Uptime :")) metrics.uptime = val.replace("Uptime :", "").trim();
                }

                // Prepare payload to match our Pydantic schema
                const payload = {
                    url: url,
                    title: title,
                    headings: headings,
                    raw_content: contentArray,
                    server_metrics: metrics
                };

                // 2. Send to Backend API
                // Make sure the FastAPI server is running on localhost:8000
                const response = await fetch('http://localhost:8000/api/data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `Server error: ${response.status}`);
                }

                const data = await response.json();
                console.log("Web Data Scraper: Data updated successfully", data.inserted_id);

                return { success: true, id: data.inserted_id };

            } catch (error) {
                console.error("Scraper Error:", error);
                return { success: false, error: error.message || String(error) };
            }
        }

        // Expose function globally for manual trigger from popup
        window.extractAndSendData = extractAndSendData;

        // Run immediately upon activation/load
        extractAndSendData();

        // Implement MutationObserver to detect DOM changes (real-time data updates)
        let timeoutId = null;
        const observer = new MutationObserver((mutations) => {
            // Debounce: Wait 3 seconds after the DOM STOPS updating before we scrape to avoid spamming the server
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                console.log("Web Data Scraper: Real-time DOM change detected, re-scanning page...");
                extractAndSendData();
            }, 3000);
        });

        // Start observing the document body for added/removed nodes or text changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return { success: true, message: "Scraper initialized and observing real-time changes." };

    } catch (error) {
        console.error("Scraper Initialization Error:", error);
        return { success: false, error: error.message || String(error) };
    }
})();
