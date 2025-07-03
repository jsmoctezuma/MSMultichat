// Search paramaters
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const settingsJson = urlParams.get("settingsJson") || "";
const widgetURL = urlParams.get("widgetURL") || "";
const showUnmuteIndicator = GetBooleanParam("showUnmuteIndicator", false);

// Page elements
const widgetUrlInputWrapper = document.getElementById('widgetUrlInputWrapper');
const widgetUrlInput = document.getElementById('widgetUrlInput');
const urlLabel = document.getElementById('urlLabel');
const settingsPanel = document.getElementById('settingsPanel');
const widgetPreview = document.getElementById('widgetPreview');
const loadURLBox = document.getElementById('loadUrlBox');
const loadDefaultsBox = document.getElementById('loadDefaultsWrapper');
const loadSettingsBox = document.getElementById('loadSettingsWrapper');
const unmuteLabel = document.getElementById('unmute-label');

// Global variables
let settingsData = '';
let settingsMap = new Map();

// Construct local storage key prefix so that each widget has their own unique settings
const parts = widgetURL.replace(/\/?$/, '').split('/');
const keyPrefix = parts[parts.length - 1];

// Set visibility of the unmute indicator
if (showUnmuteIndicator)
	unmuteLabel.style.display = 'inline';

// Set hint text for "Load URL" text input
loadURLBox.placeholder = `${widgetURL}?…`



/////////////////////////////
// LOAD FROM SETTINGS.JSON //
/////////////////////////////

function LoadJSON(settingsJson) {
	fetch(settingsJson)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		})
		.then(data => {
			settingsData = data.settings; // Store the settings data
			CreateSettingsPage(settingsData); // Render the settings page
			LoadSettings();
		})
		.catch(error => {
			console.error('Error fetching settings:', error);
			settingsPanel.innerHTML = '<p>Error loading settings. Please ensure the settings.json file is correctly configured and accessible.</p>';
		});
}

function CreateSettingsPage(settings) {
	settingsPanel.innerHTML = ''; // Clear existing content

	settings.forEach(groupData => {
		const groupDiv = document.createElement('div');
		groupDiv.classList.add('setting-group');

		const groupTitle = document.createElement('h2');
		groupTitle.textContent = groupData.group;
		groupDiv.appendChild(groupTitle);

		groupData.settings.forEach(setting => {
			const settingItemDiv = document.createElement('div');
			settingItemDiv.classList.add('setting-item');

			// Create label
			const label = document.createElement('label');
			label.setAttribute('for', setting.name);
			label.textContent = setting.label;

			// Create input element based on type
			let inputElement;

			switch (setting.type) {
				case 'textInput':
					inputElement = document.createElement('input');
					inputElement.type = 'text';
					inputElement.id = setting.name;
					inputElement.value = setting.defaultValue;
					inputElement.placeholder = setting.placeholder || '';
					break;
				case 'numberInput':
					inputElement = document.createElement('input');
					inputElement.type = 'number';
					inputElement.id = setting.name;
					inputElement.value = setting.defaultValue;
					if (setting.min !== undefined) inputElement.min = setting.min;
					if (setting.max !== undefined) inputElement.max = setting.max;
					if (setting.step !== undefined) inputElement.step = setting.step;
					break;
				case 'colorInput':
					inputElement = document.createElement('input');
					inputElement.type = 'color';
					inputElement.id = setting.name;
					inputElement.value = setting.defaultValue;
					break;
				case 'toggle':
					inputElement = document.createElement('label');
					inputElement.classList.add('switch');
					const checkbox = document.createElement('input');
					checkbox.type = 'checkbox';
					checkbox.id = setting.name;
					checkbox.checked = setting.defaultValue;
					inputElement.appendChild(checkbox);
					const slider = document.createElement('span');
					slider.classList.add('slider', 'round');
					inputElement.appendChild(slider);
					break;
				case 'select':
					inputElement = document.createElement('select');
					inputElement.id = setting.name;
					setting.options.forEach(optionData => {
						const option = document.createElement('option');
						option.value = optionData.value;
						option.textContent = optionData.label;
						if (optionData.value === setting.defaultValue) {
							option.selected = true;
						}
						inputElement.appendChild(option);
					});
					break;
				case 'heading':
					inputElement = document.createElement('h3');
					inputElement.textContent = setting.label;
					inputElement.style.cssText = 'color: #ccc; margin-top: 15px; margin-bottom: 5px;';
					settingItemDiv.appendChild(inputElement); // Append heading directly
					groupDiv.appendChild(settingItemDiv); // Append to group and continue
					return;
				case 'button':
					inputElement = document.createElement('button');
					inputElement.id = setting.name;
					inputElement.textContent = setting.label;
					inputElement.onclick = () => window[setting.action](); // Call a global function
					break;
				default:
					console.warn('Unknown setting type:', setting.type);
					return;
			}

			if (setting.type !== 'heading') {
				settingItemDiv.appendChild(label);
				if (inputElement) {
					settingItemDiv.appendChild(inputElement);
					settingsMap.set(setting.name, inputElement); // Store reference for easy access
					inputElement.addEventListener('input', GenerateURL); // Add event listener for URL generation
				}
				groupDiv.appendChild(settingItemDiv);
			}
		});
		settingsPanel.appendChild(groupDiv);
	});

	GenerateURL(); // Initial URL generation
}

function GenerateURL() {
	const params = new URLSearchParams();

	settingsData.forEach(groupData => {
		groupData.settings.forEach(setting => {
			if (setting.type === 'heading' || setting.type === 'button') return; // Skip headings and buttons

			const inputElement = settingsMap.get(setting.name);
			if (inputElement) {
				let value;
				if (setting.type === 'toggle') {
					value = inputElement.querySelector('input[type="checkbox"]').checked;
				} else {
					value = inputElement.value;
				}
				params.append(setting.name, value);
			}
		});
	});

	let url = `${widgetURL}?${params.toString()}`;

	// Encode specific characters for URL
	url = url.replace(/#/g, '%23'); // Encode '#'

	widgetUrlInput.value = url;
	SaveSettings(); // Save settings to local storage on URL generation
}

function CopyURLToClipboard() {
	widgetUrlInput.select();
	document.execCommand('copy');
	urlLabel.textContent = 'Copied!';
	setTimeout(() => {
		urlLabel.textContent = 'Click to copy URL';
	}, 1500);
}

function OpenLoadURLPopup() {
	loadURLBox.style.visibility = 'visible';
	loadURLBox.style.opacity = '1';
}

function CloseLoadURLPopup() {
	loadURLBox.style.opacity = '0';
	loadURLBox.style.visibility = 'hidden';
}

function LoadURL() {
	const urlToLoad = document.getElementById('urlToLoadInput').value;
	if (urlToLoad) {
		const newUrl = new URL(urlToLoad);
		const newParams = newUrl.searchParams;

		settingsData.forEach(groupData => {
			groupData.settings.forEach(setting => {
				if (setting.type === 'heading' || setting.type === 'button') return;

				const inputElement = settingsMap.get(setting.name);
				if (inputElement) {
					const paramValue = newParams.get(setting.name);
					if (paramValue !== null) { // Only update if parameter exists in the URL
						if (setting.type === 'toggle') {
							inputElement.querySelector('input[type="checkbox"]').checked = paramValue === 'true';
						} else {
							inputElement.value = paramValue;
						}
					}
				}
			});
		});
		GenerateURL(); // Re-generate URL to update the input field
		CloseLoadURLPopup();
	}
}

function OpenLoadDefaultsPopup() {
	loadDefaultsBox.style.visibility = 'visible';
	loadDefaultsBox.style.opacity = '1';
}

function CloseLoadDefaultsPopup() {
	loadDefaultsBox.style.opacity = '0';
	loadDefaultsBox.style.visibility = 'hidden';
}

function LoadDefaults() {
	settingsData.forEach(groupData => {
		groupData.settings.forEach(setting => {
			if (setting.type === 'heading' || setting.type === 'button') return;

			const inputElement = settingsMap.get(setting.name);
			if (inputElement) {
				if (setting.type === 'toggle') {
					inputElement.querySelector('input[type="checkbox"]').checked = setting.defaultValue;
				} else {
					inputElement.value = setting.defaultValue;
				}
			}
		});
	});
	GenerateURL(); // Re-generate URL to update the input field
	CloseLoadDefaultsPopup();
}

function OpenLoadSettingsPopup() {
	loadSettingsBox.style.visibility = 'visible';
	loadSettingsBox.style.opacity = '1';

	const savedSettings = localStorage.getItem(`${keyPrefix}_settings`);
	if (savedSettings) {
		document.getElementById('settingsJsonInput').value = savedSettings;
	}
}

function CloseLoadSettingsPopup() {
	loadSettingsBox.style.opacity = '0';
	loadSettingsBox.style.visibility = 'hidden';
}

function ImportSettings() {
	const settingsJsonString = document.getElementById('settingsJsonInput').value;
	try {
		const importedSettings = JSON.parse(settingsJsonString);

		settingsData.forEach(groupData => {
			groupData.settings.forEach(setting => {
				if (setting.type === 'heading' || setting.type === 'button') return;

				const inputElement = settingsMap.get(setting.name);
				if (inputElement && importedSettings.hasOwnProperty(setting.name)) {
					if (setting.type === 'toggle') {
						inputElement.querySelector('input[type="checkbox"]').checked = importedSettings[setting.name];
					} else {
						inputElement.value = importedSettings[setting.name];
					}
				}
			});
		});
		GenerateURL();
		CloseLoadSettingsPopup();
	} catch (e) {
		alert('Invalid JSON format. Please check your settings JSON.');
		console.error('Error parsing settings JSON:', e);
	}
}

function ExportSettings() {
	const currentSettings = {};
	settingsData.forEach(groupData => {
		groupData.settings.forEach(setting => {
			if (setting.type === 'heading' || setting.type === 'button') return;

			const inputElement = settingsMap.get(setting.name);
			if (inputElement) {
				if (setting.type === 'toggle') {
					currentSettings[setting.name] = inputElement.querySelector('input[type="checkbox"]').checked;
				} else {
					currentSettings[setting.name] = inputElement.value;
				}
			}
		});
	});
	document.getElementById('settingsJsonInput').value = JSON.stringify(currentSettings, null, 2);
	CopySettingsToClipboard();
}

function CopySettingsToClipboard() {
	const settingsInput = document.getElementById('settingsJsonInput');
	settingsInput.select();
	document.execCommand('copy');
	alert('Settings JSON copied to clipboard!');
}

function SaveSettings() {
	const currentSettings = {};
	settingsData.forEach(groupData => {
		groupData.settings.forEach(setting => {
			if (setting.type === 'heading' || setting.type === 'button') return;

			const inputElement = settingsMap.get(setting.name);
			if (inputElement) {
				if (setting.type === 'toggle') {
					currentSettings[setting.name] = inputElement.querySelector('input[type="checkbox"]').checked;
				} else {
					currentSettings[setting.name] = inputElement.value;
				}
			}
		});
	});
	localStorage.setItem(`${keyPrefix}_settings`, JSON.stringify(currentSettings));
}

function LoadSettings() {
	const savedSettings = localStorage.getItem(`${keyPrefix}_settings`);
	if (savedSettings) {
		try {
			const parsedSettings = JSON.parse(savedSettings);
			settingsData.forEach(groupData => {
				groupData.settings.forEach(setting => {
					if (setting.type === 'heading' || setting.type === 'button') return;

					const inputElement = settingsMap.get(setting.name);
					if (inputElement && parsedSettings.hasOwnProperty(setting.name)) {
						if (setting.type === 'toggle') {
							inputElement.querySelector('input[type="checkbox"]').checked = parsedSettings[setting.name];
						} else {
							inputElement.value = parsedSettings[setting.name];
						}
					}
				});
			});
			GenerateURL(); // Re-generate URL with loaded settings
		} catch (e) {
			console.error("Error parsing saved settings from localStorage:", e);
			// Optionally, clear invalid data
			localStorage.removeItem(`${keyPrefix}_settings`);
		}
	}
	GenerateURL(); // Always generate URL to ensure it's up-to-date
}

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

function GetBooleanParam(paramName, defaultValue) {
	const urlParams = new URLSearchParams(window.location.search);
	const paramValue = urlParams.get(paramName);

	if (paramValue === null) {
		return defaultValue; // Parameter not found
	}

	const lowercaseValue = paramValue.toLowerCase(); // Handle case-insensitivity

	if (lowercaseValue === 'true') {
		return true;
	} else if (lowercaseValue === 'false') {
		return false;
	} else {
		// If the parameter is present but not 'true' or 'false',
		// return the default value or handle as an error
		console.warn(`Invalid boolean value for parameter '${paramName}': '${paramValue}'. Using default: ${defaultValue}`);
		return defaultValue;
	}
}

function GetIntParam(paramName, defaultValue) {
	const urlParams = new URLSearchParams(window.location.search);
	const paramValue = urlParams.get(paramName);

	if (paramValue === null) {
		return defaultValue; // or undefined, or a default value, depending on your needs
	}

	const intValue = parseInt(paramValue, 10); // Parse as base 10 integer

	if (isNaN(intValue)) {
		return null; // or handle the error in another way, e.g., throw an error
	}

	return intValue;
}


// Handle first window interaction
window.addEventListener('message', (event) => {
	if (event.origin === new URL(widgetPreview.src).origin && event.data === 'iframe-interacted') {
		iframeHasBeenInteractedWith = true;
		console.log('Iframe has been interacted with!');
		unmuteLabel.style.display = 'none'; // Hide unmute indicator
	}
});

////////////////////
// INITIALIZATION //
////////////////////
LoadJSON(settingsJson);