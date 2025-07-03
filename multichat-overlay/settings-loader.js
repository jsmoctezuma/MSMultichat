document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('mainContainer');
    const widgetContainer = document.getElementById('widgetContainer');

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const showSettingsPage = urlParams.has('settings');

    if (showSettingsPage) {
        // Hide main chat container
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }

        // Show and configure the settings iframe
        if (widgetContainer) {
            widgetContainer.style.display = 'block'; // Make iframe visible

            // Construct the URL for the settings page
            const settingsPageURL = '../../utilities/settings-page-builder/index.html'; // Path to your settings page
            const currentURL = window.location.href;

            let settingsJSONParam = '';
            let widgetURLParam = '';

            // Check if we need to pass settings JSON to the settings page
            if (urlParams.has('settingsJson')) {
                // If settingsJson is already in the main URL, pass it through
                settingsJSONParam = `?settingsJson=${encodeURIComponent(urlParams.get('settingsJson'))}`;
            } else {
                // Otherwise, construct the path to your default settings.json
                // Assumes utilities/settings.json is two levels up from multichat-overlay/
                let baseURL = currentURL.split('?')[0]; // Remove existing query params for base path
                if (baseURL.endsWith("index.html")) {
                    baseURL = baseURL.substring(0, baseURL.lastIndexOf('/'));
                }
                const parts = baseURL.split('/');
                // Go up two directories from multichat-overlay to reach MSMultichat/
                // Then append utilities/settings.json
                const githubPagesRoot = parts.slice(0, parts.length - 1).join('/') + '/'; // Goes from /multichat-overlay/ to /MSMultichat/
                settingsJSONParam = `?settingsJson=${encodeURIComponent(githubPagesRoot + 'utilities/settings.json')}`;
            }
            
            // Pass the original widget URL (this overlay's URL) to the settings page
            // This allows the settings page to generate a new URL for the user to copy-paste back into OBS
            widgetURLParam = `&widgetURL=${encodeURIComponent(currentURL.split('?')[0])}`; // Only base URL without params


            // Set the src of the iframe
            widgetContainer.src = `${settingsPageURL}${settingsJSONParam}${widgetURLParam}`;
            
        } else {
            console.error('Error: widgetContainer (iframe for settings) not found in multichat-overlay/index.html');
        }
    } else {
        // If 'settings' parameter is not present, hide the settings iframe and show chat
        if (widgetContainer) {
            widgetContainer.style.display = 'none';
        }
        if (mainContainer) {
            mainContainer.style.display = 'flex'; // Or 'block', depending on your CSS for #mainContainer
        }
        // No need to do anything with the src of widgetContainer as it's hidden.
    }
});