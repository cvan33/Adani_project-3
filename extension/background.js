// Background service worker for Web Data Scraper

console.log("Background service worker started");

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed or updated");
});
