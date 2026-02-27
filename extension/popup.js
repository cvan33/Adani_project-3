document.addEventListener('DOMContentLoaded', function () {
    const extractBtn = document.getElementById('extractBtn');
    const statusDiv = document.getElementById('status');

    extractBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Extracting...';
        statusDiv.style.color = '#333';

        try {
            // Get the current active tab
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                statusDiv.textContent = 'Error: No active tab found.';
                statusDiv.style.color = 'red';
                return;
            }

            // Save domain to chrome.storage.local to enable auto-extraction on refresh
            const url = new URL(tab.url);
            const domain = url.hostname;

            await new Promise((resolve) => {
                chrome.storage.local.get(['active_domains'], function (result) {
                    let activeDomains = result.active_domains || [];
                    if (!activeDomains.includes(domain)) {
                        activeDomains.push(domain);
                        chrome.storage.local.set({ active_domains: activeDomains }, resolve);
                    } else {
                        resolve();
                    }
                });
            });

            // Execute the content script on the current tab to extract and send data
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Handle the message sent back from content.js indicating success/failure
            if (results && results[0] && results[0].result) {
                if (results[0].result.success) {
                    statusDiv.textContent = `Success! Saved to DB.`;
                    statusDiv.style.color = 'green';
                } else {
                    statusDiv.textContent = `Error: ${results[0].result.error}`;
                    statusDiv.style.color = 'red';
                }
            } else {
                statusDiv.textContent = 'No response from page.';
                statusDiv.style.color = 'red';
            }

        } catch (err) {
            console.error("Popup Error:", err);
            statusDiv.textContent = 'An error occurred. Make sure API is running.';
            statusDiv.style.color = 'red';
        }
    });
});
