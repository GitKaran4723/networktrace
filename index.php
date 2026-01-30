<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Route Tracer - Network Path Visualization</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="Visualize network packet routes on an interactive world map. Trace the path your data takes across the internet.">
    
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- Main Container -->
    <div class="container">
        <!-- Header Section -->
        <header class="header">
            <div class="header-content">
                <h1 class="title">
                    <span class="icon">🌐</span>
                    Visual Route Tracer
                </h1>
                <p class="subtitle">Trace network paths across the globe in real-time</p>
            </div>
        </header>

        <!-- Search Section -->
        <section class="search-section">
            <form id="traceForm" class="search-form">
                <div class="input-group">
                    <input 
                        type="text" 
                        id="targetInput" 
                        class="search-input" 
                        placeholder="Enter domain or IP (e.g., google.com)" 
                        required
                        autocomplete="off"
                    >
                    <button type="submit" id="traceBtn" class="search-btn">
                        <span class="btn-text">Trace Route</span>
                        <span class="btn-icon">→</span>
                    </button>
                </div>
                <!-- Loading Indicator with Progress -->
                <div id="loadingIndicator" class="loading-indicator hidden">
                    <div class="loading-content">
                        <div class="spinner"></div>
                        <div class="loading-text">
                            <span id="loadingMessage">Tracing route...</span>
                            <span id="loadingPercentage" class="loading-percentage">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div id="progressFill" class="progress-fill"></div>
                        </div>
                    </div>
                </div>
            </form>
        </section>

        <!-- Map Section -->
        <section class="map-section">
            <div id="map" class="map-container"></div>
            
            <!-- Hop Details Panel -->
            <div id="hopDetails" class="hop-details hidden">
                <div class="hop-details-header">
                    <h3>Route Details</h3>
                    <button id="closeDetails" class="close-btn">×</button>
                </div>
                <div id="hopList" class="hop-list">
                    <!-- Hop details will be populated here -->
                </div>
            </div>
        </section>

        <!-- Info Section -->
        <section class="info-section">
            <div class="info-card">
                <div class="info-icon">📍</div>
                <h3>Real-time Tracking</h3>
                <p>Watch your packets travel across the internet infrastructure</p>
            </div>
            <div class="info-card">
                <div class="info-icon">🗺️</div>
                <h3>Global Visualization</h3>
                <p>See the geographical path your data takes to reach its destination</p>
            </div>
            <div class="info-card">
                <div class="info-icon">⚡</div>
                <h3>Network Insights</h3>
                <p>Analyze hop counts, latency, and routing decisions</p>
            </div>
        </section>

        <!-- Footer -->
        <footer class="footer">
            <p>Built with ❤️ for network enthusiasts | Powered by Leaflet.js & ip-api.com</p>
        </footer>
    </div>

    <!-- Leaflet JS -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    
    <!-- Custom JS -->
    <script src="js/app.js"></script>
</body>
</html>
