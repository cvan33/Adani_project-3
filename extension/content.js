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

                // Remove unwanted elements: nav, footer, header, scripts, styles, links, sidebars, etc.
                const elementsToRemove = clonedBody.querySelectorAll(`
                    nav, footer, header, script, style, a, noscript, iframe, 
                    [role="navigation"], [role="banner"], [role="contentinfo"],
                    .nav, .navigation, .navbar, .header, .footer, .sidebar, .aside,
                    #nav, #navigation, #navbar, #header, #footer, #sidebar, #aside
                `);
                elementsToRemove.forEach(el => el.remove());

                // Extract the remaining text content, split by newlines, and clean up
                let rawText = clonedBody.innerText || clonedBody.textContent;
                let contentArray = rawText.split('\n')
                    .map(text => text.replace(/\s+/g, ' ').trim())
                    .filter(text => text.length > 0);

                // Helper to find value following a label in contentArray
                const getValueAfter = (label) => {
                    const idx = contentArray.indexOf(label);
                    return (idx !== -1 && idx + 1 < contentArray.length) ? contentArray[idx + 1] : null;
                };

                // Helper to find value before a label (for % metrics)
                const getValueBefore = (label, offset = 1) => {
                    const idx = contentArray.indexOf(label);
                    return (idx !== -1 && idx - offset >= 0) ? contentArray[idx - offset] : null;
                };

                const performance = {
                    availability: getValueBefore("Availability", 2) ? getValueBefore("Availability", 2) + "%" : null,
                    cpu_usage: getValueBefore("CPU", 2) ? getValueBefore("CPU", 2) + "%" : null,
                    memory_usage: getValueBefore("Memory", 2) ? getValueBefore("Memory", 2) + "%" : null,
                    disk_usage: getValueBefore("Disk", 2) ? getValueBefore("Disk", 2) + "%" : null,
                    downtimes: getValueBefore("Downtimes", 1)
                };

                const system = {
                    hostname: getValueAfter("Hostname"),
                    ip_address: getValueAfter("IP Address"),
                    os_name: getValueAfter("OS Name"),
                    os_version: getValueAfter("OS Version"),
                    kernel_version: getValueAfter("Kernel Version"),
                    processor: getValueAfter("Processor"),
                    manufacturer: getValueAfter("Manufacturer"),
                    model: getValueAfter("Model"),
                    serial_number: getValueAfter("Serial Number")
                };

                const resources = {
                    ram_size: getValueAfter("RAM Size"),
                    cpu_cores: getValueAfter("CPU Cores"),
                    total_disk_partitions: getValueAfter("Total Disk Partition"),
                    total_network_interfaces: getValueAfter("Total Network Interfaces"),
                    last_boot_time: getValueAfter("Last Boot Time"),
                    time_zone: getValueAfter("Time Zone"),
                    public_ip: getValueAfter("Public IP Address"),
                    location: getValueAfter("Country") ? `${getValueAfter("Country")}, ${getValueAfter("Region") || ""}`.trim().replace(/,$/, "") : null
                };

                // Prepare payload to match our new Pydantic schema
                const payload = {
                    url: url,
                    title: title,
                    headings: headings,
                    raw_content: contentArray,
                    performance: performance,
                    system: system,
                    resources: resources
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

        // Implement MutationObserver to detect DOM changes (real-time data updates) after initial trigger
        let timeoutId = null;
        const observer = new MutationObserver((mutations) => {
            // Debounce: Wait 2 seconds after the DOM STOPS updating before we scrape to avoid spamming the server
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                console.log("Web Data Scraper: Real-time DOM change detected, updating data...");
                extractAndSendData();
            }, 2000);
        });

        // Start observing the document body for added/removed nodes or text changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return { success: true, message: "Scraper initialized and watching for real-time changes." };

    } catch (error) {
        console.error("Scraper Initialization Error:", error);
        return { success: false, error: error.message || String(error) };
    }
})();
