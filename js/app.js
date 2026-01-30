// ============================================
// GLOBAL VARIABLES & INITIALIZATION
// ============================================

// Map instance
let map;

// Markers and polylines for visualization
let markers = [];
let polylines = [];

// Current trace data
let currentTraceData = null;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeMap();
    setupEventListeners();
});

// ============================================
// MAP INITIALIZATION
// ============================================

/**
 * Initialize the Leaflet map with dark theme tiles
 */
function initializeMap() {
    // Create map centered on the world
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        scrollWheelZoom: true
    });

    // Add dark theme tile layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Alternative: Stadia Dark theme (uncomment to use)
    // L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    //     attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
    //     maxZoom: 20
    // }).addTo(map);
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
    // Form submission
    const traceForm = document.getElementById('traceForm');
    traceForm.addEventListener('submit', handleTraceSubmit);

    // Close details panel
    const closeBtn = document.getElementById('closeDetails');
    closeBtn.addEventListener('click', hideHopDetails);
}

// ============================================
// TRACE ROUTE FUNCTIONALITY
// ============================================

/**
 * Handle the trace route form submission
 * @param {Event} e - Form submit event
 */
async function handleTraceSubmit(e) {
    e.preventDefault();

    // Get the target domain/IP from input
    const targetInput = document.getElementById('targetInput');
    const target = targetInput.value.trim();

    if (!target) {
        showError('Please enter a valid domain or IP address');
        return;
    }

    // Show loading state
    showLoading(true);
    clearMap();
    hideHopDetails();

    try {
        // Call the PHP API to perform traceroute
        const response = await fetch(`api/trace.php?target=${encodeURIComponent(target)}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Check if the API returned an error
        if (data.error) {
            throw new Error(data.error);
        }

        // Store the trace data
        currentTraceData = data;

        // Visualize the route on the map
        visualizeRoute(data);

        // Show hop details panel
        displayHopDetails(data);

    } catch (error) {
        console.error('Trace error:', error);
        showError(`Failed to trace route: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// ============================================
// MAP VISUALIZATION
// ============================================

/**
 * Visualize the traced route on the map
 * @param {Object} data - Trace data from API
 */
function visualizeRoute(data) {
    if (!data.hops || data.hops.length === 0) {
        showError('No hops found in the trace route');
        return;
    }

    // Filter out hops without valid coordinates
    const validHops = data.hops.filter(hop => hop.lat && hop.lon);

    if (validHops.length === 0) {
        showError('No geographic data available for this route');
        return;
    }

    // Create markers for each hop with valid coordinates
    // Use the original hop number from the data
    validHops.forEach((hop) => {
        createHopMarker(hop, hop.hop - 1); // hop.hop is 1-indexed, convert to 0-indexed
    });

    // Draw lines connecting the hops
    drawRoutePath(validHops);

    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    // Animate the route drawing
    animateRoute();
}

/**
 * Create a marker for a hop on the map
 * @param {Object} hop - Hop data
 * @param {number} originalIndex - Original hop index from the trace
 */
function createHopMarker(hop, originalIndex) {
    // Create custom icon with hop number (use the actual hop number from data)
    const hopNumber = hop.hop || (originalIndex + 1);

    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-content">
                   <div class="marker-number">${hopNumber}</div>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    // Create marker
    const marker = L.marker([hop.lat, hop.lon], { icon: icon })
        .addTo(map);

    // Store the original index in the marker
    marker.originalIndex = originalIndex;

    // Create popup content
    const popupContent = `
        <div class="popup-content">
            <strong>Hop ${hopNumber}</strong><br>
            <strong>IP:</strong> ${hop.ip || 'N/A'}<br>
            ${hop.hostname ? `<strong>Host:</strong> ${hop.hostname}<br>` : ''}
            ${hop.city ? `<strong>City:</strong> ${hop.city}<br>` : ''}
            ${hop.country ? `<strong>Country:</strong> ${hop.country}<br>` : ''}
            ${hop.isp ? `<strong>ISP:</strong> ${hop.isp}<br>` : ''}
        </div>
    `;

    marker.bindPopup(popupContent);

    // Add click event to highlight in details panel
    marker.on('click', () => highlightHop(originalIndex));

    markers.push(marker);
}

/**
 * Draw lines connecting the hops
 * @param {Array} hops - Array of hop data with coordinates
 */
function drawRoutePath(hops) {
    // Create array of coordinates
    const coordinates = hops.map(hop => [hop.lat, hop.lon]);

    // Draw polyline with gradient effect
    const polyline = L.polyline(coordinates, {
        color: '#6366f1',
        weight: 3,
        opacity: 0.8,
        smoothFactor: 1,
        className: 'route-line'
    }).addTo(map);

    polylines.push(polyline);

    // Add animated decorator (arrows showing direction)
    // This requires leaflet-polylineDecorator plugin, which we'll skip for simplicity
    // But you can add it for enhanced visualization
}

/**
 * Animate the route drawing with a progressive reveal effect
 */
function animateRoute() {
    // Fade in markers sequentially
    markers.forEach((marker, index) => {
        setTimeout(() => {
            const element = marker.getElement();
            if (element) {
                element.style.opacity = '0';
                element.style.transform = 'scale(0)';
                element.style.transition = 'all 0.5s ease';

                setTimeout(() => {
                    element.style.opacity = '1';
                    element.style.transform = 'scale(1)';
                }, 50);
            }
        }, index * 200);
    });
}

// ============================================
// HOP DETAILS PANEL
// ============================================

/**
 * Display hop details in the side panel
 * @param {Object} data - Trace data
 */
function displayHopDetails(data) {
    const hopList = document.getElementById('hopList');
    const hopDetails = document.getElementById('hopDetails');

    // Clear existing content
    hopList.innerHTML = '';

    // Create hop items
    data.hops.forEach((hop, index) => {
        const hopItem = createHopItem(hop, index);
        hopList.appendChild(hopItem);
    });

    // Show the panel
    hopDetails.classList.remove('hidden');
}

/**
 * Create a hop item element for the details panel
 * @param {Object} hop - Hop data
 * @param {number} index - Hop index
 * @returns {HTMLElement} Hop item element
 */
function createHopItem(hop, index) {
    const div = document.createElement('div');
    div.className = 'hop-item';
    div.dataset.hopIndex = index;

    // Format location string
    let location = 'Unknown location';
    if (hop.city && hop.country) {
        location = `${hop.city}, ${hop.country}`;
    } else if (hop.country) {
        location = hop.country;
    }

    div.innerHTML = `
        <div class="hop-number">Hop ${index + 1}</div>
        <div class="hop-ip">${hop.ip || 'N/A'}</div>
        ${hop.hostname ? `<div class="hop-hostname">${hop.hostname}</div>` : ''}
        <div class="hop-location">📍 ${location}</div>
        ${hop.isp ? `<div class="hop-isp">🌐 ${hop.isp}</div>` : ''}
    `;

    // Add click event to zoom to marker
    div.addEventListener('click', () => {
        if (hop.lat && hop.lon) {
            // Find the marker with this original index
            const marker = markers.find(m => m.originalIndex === index);
            if (marker) {
                map.setView([hop.lat, hop.lon], 8);
                marker.openPopup();
                highlightHop(index);
            }
        }
    });

    return div;
}

/**
 * Highlight a specific hop in the details panel
 * @param {number} index - Hop index to highlight
 */
function highlightHop(index) {
    // Remove previous highlights
    document.querySelectorAll('.hop-item').forEach(item => {
        item.style.background = 'rgba(255, 255, 255, 0.03)';
    });

    // Highlight selected hop
    const hopItem = document.querySelector(`[data-hop-index="${index}"]`);
    if (hopItem) {
        hopItem.style.background = 'rgba(99, 102, 241, 0.2)';
        hopItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Hide the hop details panel
 */
function hideHopDetails() {
    const hopDetails = document.getElementById('hopDetails');
    hopDetails.classList.add('hidden');
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * Show or hide the loading indicator
 * @param {boolean} show - Whether to show loading
 */
// Progress simulator
let progressInterval;

/**
 * Show or hide the loading indicator
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const traceBtn = document.getElementById('traceBtn');

    if (show) {
        loadingIndicator.classList.remove('hidden');
        traceBtn.disabled = true;
        traceBtn.style.opacity = '0.6';
        startProgress();
    } else {
        loadingIndicator.classList.add('hidden');
        traceBtn.disabled = false;
        traceBtn.style.opacity = '1';
        stopProgress();
    }
}

/**
 * Start simulated progress
 */
function startProgress() {
    const progressBar = document.getElementById('progressFill');
    const percentageText = document.getElementById('loadingPercentage');
    const messageText = document.getElementById('loadingMessage');

    let progress = 0;

    // Reset
    if (progressBar) progressBar.style.width = '0%';
    if (percentageText) percentageText.textContent = '0%';

    // Messages to cycle through
    const messages = [
        "Resolving domain...",
        "Starting hops...",
        "Analyzing route...",
        "Identifying location...",
        "Finalizing..."
    ];

    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        // Logarithmic-like increment to prevent reaching 100% before done
        let increment = 0;
        if (progress < 30) increment = 2;       // Fast start
        else if (progress < 60) increment = 0.8; // Steady middle
        else if (progress < 80) increment = 0.4; // Slower
        else if (progress < 95) increment = 0.1; // Very slow near end

        progress += increment;

        // Cap at 99% until actual complete
        if (progress > 99) progress = 99;

        // Update UI
        const currentPercent = Math.round(progress);
        if (progressBar) progressBar.style.width = `${currentPercent}%`;
        if (percentageText) percentageText.textContent = `${currentPercent}%`;

        // Update message based on progress
        if (messageText) {
            if (currentPercent < 20) messageText.textContent = messages[0];
            else if (currentPercent < 40) messageText.textContent = messages[1];
            else if (currentPercent < 70) messageText.textContent = messages[2];
            else if (currentPercent < 90) messageText.textContent = messages[3];
            else messageText.textContent = messages[4];
        }

    }, 200); // MUpdate every 200ms
}

/**
 * Stop progress simulation
 */
function stopProgress() {
    clearInterval(progressInterval);
    const progressBar = document.getElementById('progressFill');
    const percentageText = document.getElementById('loadingPercentage');

    // Jump to 100%
    if (progressBar) progressBar.style.width = '100%';
    if (percentageText) percentageText.textContent = '100%';
}

/**
 * Display an error message to the user
 * @param {string} message - Error message
 */
function showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        errorDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}

/**
 * Clear all markers and polylines from the map
 */
function clearMap() {
    // Remove all markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Remove all polylines
    polylines.forEach(polyline => map.removeLayer(polyline));
    polylines = [];

    // Reset map view
    map.setView([20, 0], 2);
}

// ============================================
// CUSTOM MARKER STYLES (injected dynamically)
// ============================================

// Inject custom marker styles
const style = document.createElement('style');
style.textContent = `
    .custom-marker {
        background: transparent;
        border: none;
    }
    
    .marker-content {
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
        border: 2px solid rgba(255, 255, 255, 0.3);
        transition: all 0.3s ease;
    }
    
    .marker-content:hover {
        transform: scale(1.2);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.7);
    }
    
    .marker-number {
        color: white;
        font-weight: 700;
        font-size: 0.75rem;
    }
    
    .route-line {
        animation: dashAnimation 2s linear infinite;
    }
    
    @keyframes dashAnimation {
        to {
            stroke-dashoffset: -20;
        }
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: translateY(-10px);
        }
    }
    
    .popup-content {
        font-size: 0.9rem;
        line-height: 1.6;
    }
    
    .popup-content strong {
        color: #6366f1;
    }
    
    .hop-hostname {
        font-size: 0.85rem;
        color: #a0aec0;
        margin-bottom: 4px;
        font-family: 'Courier New', monospace;
    }
    
    .hop-isp {
        font-size: 0.85rem;
        color: #a0aec0;
        margin-top: 4px;
    }
`;
document.head.appendChild(style);
