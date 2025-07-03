document.addEventListener('DOMContentLoaded', async () => {
    const settingsForm = document.getElementById('settingsForm');
    const widgetPreview = document.getElementById('widgetPreview');
    const jsonInputOutput = document.getElementById('jsonInputOutput');
    const generatedUrlOutput = document.getElementById('generatedUrlOutput');
    const urlToLoadInput = document.getElementById('urlToLoadInput');

    // Popups and their buttons
    const loadUrlWrapper = document.getElementById('loadUrlWrapper');
    const loadUrlBox = document.getElementById('loadUrlBox'); // Not strictly needed, but common to grab the inner box
    const loadFromUrlButton = document.getElementById('loadFromUrlButton');
    const closeLoadUrlButton = document.getElementById('closeLoadUrlButton');

    const loadDefaultsWrapper = document.getElementById('loadDefaultsWrapper');
    const confirmLoadDefaultsButton = document.getElementById('confirmLoadDefaultsButton');
    const cancelLoadDefaultsButton = document.getElementById('cancelLoadDefaultsButton');

    const loadSettingsWrapper = document.getElementById('loadSettingsWrapper');
    const loadJsonButton = document.getElementById('loadJsonButton');
    const copyJsonButton = document.getElementById('copyJsonButton');
    const closeLoadSettingsButton = document.getElementById('closeLoadSettingsButton');

    const urlOutputWrapper = document.getElementById('urlOutputWrapper');
    const copyGeneratedUrlButton = document.getElementById('copyGeneratedUrlButton');
    const closeUrlOutputButton = document.getElementById('closeUrlOutputButton');

    let allSettings = {}; // To store all settings, including their default values

    // Get parameters from the current URL of the settings page
    const urlParams = new URLSearchParams(window.location.search);
    const settingsJsonURL = urlParams.get('settingsJson');
    let widgetBaseURL = urlParams.get('widgetURL');

    // Default widgetBaseURL if not provided (fallback for direct access to settings page)
    if (!widgetBaseURL) {
        // Attempt to guess the widgetBaseURL if accessing settings page directly
        // This assumes settings-page-builder is inside utilities/ and multichat-overlay is sibling to utilities/
        const currentPath = window.location.href;
        const parts = currentPath.split('/');
        // Go up two levels (from settings-page-builder to MSMultichat), then down to multichat-overlay
        if (parts.length >= 3) { // Ensure enough parts to go up
            widgetBaseURL = parts.slice(0, parts.length - 3).join('/') + '/multichat-overlay/index.html';
        } else {
            widgetBaseURL = ''; // Fallback if path is too short
        }
    }

    // Function to fetch settings definition from settings.json
    async function fetchSettingsDefinition(jsonURL) {
        try {
            const response = await fetch(jsonURL);
            if (!response.ok) {
                // If it's a 404 and we're trying to fetch a local file, try direct path as fallback
                if (response.status === 404 && jsonURL.startsWith('file://')) {
                     console.warn('Could not fetch settings.json directly, trying relative path.');
                     // This might happen if the file:// path is incorrect for local testing,
                     // or if it's trying to load from a raw GitHub URL that doesn't serve JSON properly.
                     // For GitHub Pages, the actual URL should work.
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.settings;
        } catch (error) {
            console.error('Error fetching settings definition:', error);
            alert('Failed to load settings definition. Please check console for details.');
            return null;
        }
    }

    // Function to generate the HTML for a setting control
    function createSettingControl(setting) {
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('setting-control');

        let inputElement;

        switch (setting.type) {
            case 'textInput':
            case 'numberInput':
                inputElement = document.createElement('input');
                inputElement.type = setting.type === 'textInput' ? 'text' : 'number';
                inputElement.id = setting.name;
                if (setting.defaultValue !== undefined) inputElement.value = setting.defaultValue;
                if (setting.placeholder) inputElement.placeholder = setting.placeholder;
                if (setting.min !== undefined) inputElement.min = setting.min;
                if (setting.max !== undefined) inputElement.max = setting.max;
                if (setting.step !== undefined) inputElement.step = setting.step;
                break;
            case 'toggle':
                controlDiv.classList.add('toggle-switch-container'); // Add specific class for styling
                const labelElement = document.createElement('label');
                labelElement.classList.add('switch');

                inputElement = document.createElement('input');
                inputElement.type = 'checkbox';
                inputElement.id = setting.name;
                inputElement.checked = setting.defaultValue;

                const slider = document.createElement('span');
                slider.classList.add('slider');

                labelElement.appendChild(inputElement);
                labelElement.appendChild(slider);
                controlDiv.appendChild(labelElement);
                return controlDiv; // Return early for toggle, as its structure is different
            case 'colorInput':
                inputElement = document.createElement('input');
                inputElement.type = 'color';
                inputElement.id = setting.name;
                if (setting.defaultValue) inputElement.value = setting.defaultValue;
                break;
            case 'select':
                inputElement = document.createElement('select');
                inputElement.id = setting.name;
                setting.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.value;
                    optionElement.textContent = option.label;
                    inputElement.appendChild(optionElement);
                });
                if (setting.defaultValue) inputElement.value = setting.defaultValue;
                break;
            case 'button':
                inputElement = document.createElement('button');
                inputElement.id = setting.name;
                inputElement.textContent = setting.label;
                inputElement.classList.add('action-button'); // Add a class for styling
                inputElement.onclick = () => handleButtonAction(setting.action);
                break;
            default:
                inputElement = document.createElement('span');
                inputElement.textContent = 'Unsupported type';
        }
        controlDiv.appendChild(inputElement);
        return controlDiv;
    }

    // Function to render the settings form based on the definition
    function renderSettingsForm(settingsDef) {
        settingsForm.innerHTML = ''; // Clear previous form
        settingsDef.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('setting-group');

            const groupHeader = document.createElement('h2');
            groupHeader.classList.add('group-header');
            groupHeader.textContent = group.group;
            groupDiv.appendChild(groupHeader);

            group.settings.forEach(setting => {
                const settingItemDiv = document.createElement('div');
                settingItemDiv.classList.add('setting-item');

                const label = document.createElement('label');
                label.classList.add('setting-label');
                label.setAttribute('for', setting.name);
                label.textContent = setting.label;
                settingItemDiv.appendChild(label);

                const control = createSettingControl(setting);
                settingItemDiv.appendChild(control);

                groupDiv.appendChild(settingItemDiv);

                // Store default value and type
                allSettings[setting.name] = {
                    defaultValue: setting.defaultValue,
                    type: setting.type,
                    min: setting.min,
                    max: setting.max,
                    step: setting.step,
                    options: setting.options
                };
            });
            settingsForm.appendChild(groupDiv);
        });

        // Add event listeners for input changes to update preview and URL
        document.querySelectorAll('#settingsForm input, #settingsForm select').forEach(element => {
            if (element.type !== 'button') { // Buttons don't trigger settings changes directly
                element.addEventListener('change', updatePreviewAndURL);
                if (element.type === 'number' || element.type === 'text') {
                    element.addEventListener('input', updatePreviewAndURL); // For continuous updates
                }
            }
        });
        updatePreviewAndURL(); // Initial update
    }

    // Function to get current settings from the form
    function getCurrentSettings() {
        const currentSettings = {};
        for (const name in allSettings) {
            const element = document.getElementById(name);
            if (element) {
                if (allSettings[name].type === 'toggle') {
                    currentSettings[name] = element.checked;
                } else if (allSettings[name].type === 'numberInput') {
                    currentSettings[name] = parseFloat(element.value);
                } else {
                    currentSettings[name] = element.value;
                }
            } else {
                // If element not found (e.g., a button), use its default or skip
                if (allSettings[name].type !== 'button') {
                     currentSettings[name] = allSettings[name].defaultValue;
                }
            }
        }
        return currentSettings;
    }

    // Function to apply settings to the form
    function applySettingsToForm(settings) {
        for (const name in settings) {
            const element = document.getElementById(name);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = settings[name];
                } else {
                    element.value = settings[name];
                }
            }
        }
        updatePreviewAndURL(); // Update preview after applying settings
    }

    // Function to generate the URL with current settings
    function generateOverlayURL() {
        const currentSettings = getCurrentSettings();
        const params = new URLSearchParams();

        for (const key in currentSettings) {
            if (currentSettings.hasOwnProperty(key)) {
                // Only add parameters if they differ from the default
                if (currentSettings[key] !== allSettings[key].defaultValue) {
                    params.append(key, currentSettings[key]);
                }
            }
        }

        let newURL = widgetBaseURL;
        if (params.toString()) {
            // Append parameters to the base URL
            // If the base URL already has parameters (unlikely for a clean base), append with &
            newURL += (newURL.includes('?') ? '&' : '?') + params.toString();
        }
        return newURL;
    }

    // Function to update the widget preview iframe and generated URL display
    function updatePreviewAndURL() {
        const newURL = generateOverlayURL();
        widgetPreview.src = newURL;
        generatedUrlOutput.textContent = newURL;
    }

    // Popup management functions
    function openPopup(wrapperElement) {
        wrapperElement.style.display = 'flex';
    }

    function closePopup(wrapperElement) {
        wrapperElement.style.display = 'none';
    }

    // Handle button actions
    function handleButtonAction(action) {
        switch (action) {
            case 'OpenLoadURLPopup':
                urlToLoadInput.value = ''; // Clear previous input
                openPopup(loadUrlWrapper);
                break;
            case 'OpenLoadDefaultsPopup':
                openPopup(loadDefaultsWrapper);
                break;
            case 'OpenLoadSettingsPopup':
                jsonInputOutput.value = JSON.stringify(getCurrentSettings(), null, 2); // Populate with current settings
                openPopup(loadSettingsWrapper);
                break;
            default:
                console.warn('Unknown button action:', action);
        }
    }

    // Event Listeners for popups
    if(loadFromUrlButton) {
        loadFromUrlButton.addEventListener('click', () => {
            const urlString = urlToLoadInput.value;
            try {
                const url = new URL(urlString);
                const params = new URLSearchParams(url.search);
                const loadedSettings = {};
                for (const [key, value] of params.entries()) {
                    if (allSettings[key]) { // Only load if the setting exists in our definition
                        if (allSettings[key].type === 'toggle') {
                            loadedSettings[key] = value === 'true'; // Convert string 'true'/'false' to boolean
                        } else if (allSettings[key].type === 'numberInput') {
                            loadedSettings[key] = parseFloat(value);
                        } else {
                            loadedSettings[key] = value;
                        }
                    }
                }
                applySettingsToForm(loadedSettings);
                closePopup(loadUrlWrapper);
            } catch (e) {
                alert('Invalid URL provided. Please enter a full, valid URL.');
                console.error('Error parsing URL:', e);
            }
        });
    }
    if(closeLoadUrlButton) closeLoadUrlButton.addEventListener('click', () => closePopup(loadUrlWrapper));

    if(confirmLoadDefaultsButton) {
        confirmLoadDefaultsButton.addEventListener('click', () => {
            // Reapply all settings with their default values
            for (const name in allSettings) {
                const element = document.getElementById(name);
                if (element) {
                    if (allSettings[name].type === 'toggle') {
                        element.checked = allSettings[name].defaultValue;
                    } else {
                        element.value = allSettings[name].defaultValue;
                    }
                }
            }
            updatePreviewAndURL();
            closePopup(loadDefaultsWrapper);
        });
    }
    if(cancelLoadDefaultsButton) cancelLoadDefaultsButton.addEventListener('click', () => closePopup(loadDefaultsWrapper));

    if(loadJsonButton) {
        loadJsonButton.addEventListener('click', () => {
            try {
                const jsonString = jsonInputOutput.value;
                const loadedSettings = JSON.parse(jsonString);
                applySettingsToForm(loadedSettings);
                closePopup(loadSettingsWrapper);
            } catch (e) {
                alert('Invalid JSON provided. Please ensure it is correctly formatted.');
                console.error('Error parsing JSON:', e);
            }
        });
    }
    if(copyJsonButton) {
        copyJsonButton.addEventListener('click', () => {
            jsonInputOutput.value = JSON.stringify(getCurrentSettings(), null, 2);
            jsonInputOutput.select();
            document.execCommand('copy');
            alert('Settings JSON copied to clipboard!');
        });
    }
    if(closeLoadSettingsButton) closeLoadSettingsButton.addEventListener('click', () => closePopup(loadSettingsWrapper));

    if(copyGeneratedUrlButton) {
        copyGeneratedUrlButton.addEventListener('click', () => {
            const urlText = generatedUrlOutput.textContent;
            navigator.clipboard.writeText(urlText).then(() => {
                alert('Overlay URL copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy URL:', err);
                // Fallback for older browsers
                const tempInput = document.createElement('textarea');
                tempInput.value = urlText;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                alert('Overlay URL copied to clipboard!');
            });
        });
    }
    if(closeUrlOutputButton) closeUrlOutputButton.addEventListener('click', () => closePopup(urlOutputWrapper));


    // Initial setup
    if (settingsJsonURL) {
        fetchSettingsDefinition(settingsJsonURL).then(settingsDef => {
            if (settingsDef) {
                renderSettingsForm(settingsDef);
                // Attempt to load settings from URL parameters (if any, excluding 'settingsJson' and 'widgetURL')
                const initialSettings = {};
                for (const [key, value] of urlParams.entries()) {
                    if (key !== 'settingsJson' && key !== 'widgetURL' && allSettings[key]) {
                        if (allSettings[key].type === 'toggle') {
                            initialSettings[key] = value === 'true';
                        } else if (allSettings[key].type === 'numberInput') {
                            initialSettings[key] = parseFloat(value);
                        } else {
                            initialSettings[key] = value;
                        }
                    }
                }
                applySettingsToForm(initialSettings); // This also calls updatePreviewAndURL
            }
        });
    } else {
        alert('Error: settingsJson URL parameter missing. Cannot load settings definition.');
    }

    // Expose generated URL to a global function if needed by external buttons
    window.showGeneratedUrlPopup = function() {
        generatedUrlOutput.textContent = generateOverlayURL();
        openPopup(urlOutputWrapper);
    };

    // Add event listener to copy button in the "Load URL" popup
    if (loadFromUrlButton) { // Ensure button exists
        loadFromUrlButton.addEventListener('click', () => {
            window.showGeneratedUrlPopup(); // This might be a mistake, should trigger load settings from URL
            // Correct logic should be to load from the input URL, not show generated URL
            // The button's primary action is "Load Settings" from the input URL.
            // Let's ensure it calls the correct logic.
            const urlString = urlToLoadInput.value;
            if (urlString) {
                try {
                    const url = new URL(urlString);
                    const params = new URLSearchParams(url.search);
                    const loadedSettings = {};
                    for (const [key, value] of params.entries()) {
                        if (allSettings[key]) {
                            if (allSettings[key].type === 'toggle') {
                                loadedSettings[key] = value === 'true';
                            } else if (allSettings[key].type === 'numberInput') {
                                loadedSettings[key] = parseFloat(value);
                            } else {
                                loadedSettings[key] = value;
                            }
                        }
                    }
                    applySettingsToForm(loadedSettings);
                    closePopup(loadUrlWrapper);
                } catch (e) {
                    alert('Invalid URL provided for loading. Please enter a full, valid URL.');
                    console.error('Error parsing URL for loading:', e);
                }
            } else {
                alert('Please paste a URL to load settings from.');
            }
        });
    }
    // Correcting the button action for "Load URL Parameters" button in the settings form
    // It should open the popup to *input* a URL, not immediately show generated URL
    const loadUrlButtonInForm = document.getElementById('loadUrlButton'); // This is the button defined in settings.json
    if (loadUrlButtonInForm) {
        loadUrlButtonInForm.onclick = () => handleButtonAction('OpenLoadURLPopup');
    }

    // Add event listener for the button that opens the URL output popup (e.g., "Generate URL" button)
    // This button is not explicitly defined in the settings.json actions, but is crucial for UX
    // We will assume you will add a button with ID "generateUrlButton" in your settings-page-builder/index.html
    // If you don't add this button, you can trigger `window.showGeneratedUrlPopup()` via console or another means.
    const generateUrlButton = document.getElementById('generateUrlButton');
    if (generateUrlButton) {
        generateUrlButton.addEventListener('click', window.showGeneratedUrlPopup);
    }
});