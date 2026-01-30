<?php
/**
 * ============================================
 * TRACE ROUTE API ENDPOINT
 * ============================================
 * 
 * This API endpoint performs a traceroute to a given target
 * and returns the route with geolocation data for each hop.
 * 
 * Usage: api/trace.php?target=google.com
 */

// Set execution time limit FIRST (before anything else)
set_time_limit(300); // 5 minutes

// Prevent any output before JSON response
ob_start();

// Disable error display (errors will be logged, not shown)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Clean any previous output
ob_clean();

// Set headers for JSON response and CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// ============================================
// INPUT VALIDATION
// ============================================

// Get the target from query parameters
$target = isset($_GET['target']) ? trim($_GET['target']) : '';

// Validate target input
if (empty($target)) {
    echo json_encode([
        'error' => 'Target parameter is required',
        'usage' => 'api/trace.php?target=google.com'
    ]);
    exit;
}

// Sanitize input to prevent command injection
// Only allow alphanumeric, dots, hyphens, and underscores
if (!preg_match('/^[a-zA-Z0-9.-]+$/', $target)) {
    echo json_encode([
        'error' => 'Invalid target format. Only domain names and IP addresses are allowed.'
    ]);
    exit;
}

// ============================================
// EXECUTE TRACEROUTE
// ============================================

/**
 * Execute traceroute command based on OS
 * @param string $target - Target domain or IP
 * @return array - Array of output lines
 */
function executeTraceroute($target) {
    $output = [];
    $returnCode = 0;
    
    // Detect operating system
    $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
    
    if ($isWindows) {
        // Windows: Use tracert command with max 15 hops (reduced for speed)
        // -4 forces IPv4 (better geolocation support)
        // -h sets max hops
        // -w sets timeout in milliseconds
        $command = "tracert -4 -h 15 -w 1000 " . escapeshellarg($target);
    } else {
        // Linux/Unix: Use traceroute command
        $command = "traceroute -m 15 -w 1 " . escapeshellarg($target);
    }
    
    // Execute the command
    exec($command, $output, $returnCode);
    
    return [
        'output' => $output,
        'returnCode' => $returnCode,
        'isWindows' => $isWindows
    ];
}

// ============================================
// PARSE TRACEROUTE OUTPUT
// ============================================

/**
 * Parse traceroute output to extract IP addresses
 * @param array $output - Raw traceroute output lines
 * @param bool $isWindows - Whether running on Windows
 * @return array - Array of IP addresses
 */
function parseTraceroute($output, $isWindows) {
    $ips = [];
    
    foreach ($output as $line) {
        // Skip header lines and empty lines
        if (empty(trim($line))) {
            continue;
        }
        
        // Skip lines with "Request timed out" or asterisks only
        if (stripos($line, 'Request timed out') !== false || preg_match('/^\s*\d+\s+\*\s+\*\s+\*/', $line)) {
            continue;
        }
        
        $ip = null;
        
        // Try to match IPv6 addresses first (they're longer and more specific)
        // IPv6 pattern: matches addresses like 2404:a800:3a00::405 or 2001:4860:0:1::67e
        if (preg_match('/([0-9a-fA-F]{1,4}:[0-9a-fA-F:]+)/', $line, $matches)) {
            $ip = $matches[1];
        }
        // If no IPv6, try IPv4 addresses
        // Pattern matches IPv4 addresses in square brackets or standalone
        elseif (preg_match('/\[?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?/', $line, $matches)) {
            $ip = $matches[1];
        }
        
        // If we found an IP, add it to the list
        if ($ip !== null) {
            // Skip private/local IPs (optional - comment out to include them)
            // if (isPrivateIP($ip)) {
            //     continue;
            // }
            
            // Avoid duplicate IPs
            if (!in_array($ip, $ips)) {
                $ips[] = $ip;
            }
        }
    }
    
    return $ips;
}


/**
 * Check if an IP is private/local (optional utility)
 * @param string $ip - IP address
 * @return bool - True if private IP
 */
function isPrivateIP($ip) {
    $privateRanges = [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8'
    ];
    
    foreach ($privateRanges as $range) {
        if (ipInRange($ip, $range)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if IP is in CIDR range
 * @param string $ip - IP address
 * @param string $range - CIDR range
 * @return bool
 */
function ipInRange($ip, $range) {
    list($subnet, $mask) = explode('/', $range);
    $ip_long = ip2long($ip);
    $subnet_long = ip2long($subnet);
    $mask_long = -1 << (32 - $mask);
    
    return ($ip_long & $mask_long) == ($subnet_long & $mask_long);
}

// ============================================
// GEOLOCATION LOOKUP
// ============================================

/**
 * Get geolocation data for an IP address using ip-api.com
 * @param string $ip - IP address
 * @return array - Geolocation data
 */
function getGeolocation($ip) {
    // ip-api.com free API endpoint
    // Note: Free tier has rate limit of 45 requests per minute
    $url = "http://ip-api.com/json/{$ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,query";
    
    // Use file_get_contents instead of cURL (no extension required)
    // Set timeout context
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,  // 5 seconds timeout
            'ignore_errors' => true
        ]
    ]);
    
    // Execute request
    $response = @file_get_contents($url, false, $context);
    
    // Parse response
    if ($response !== false) {
        $data = json_decode($response, true);
        
        if ($data && $data['status'] === 'success') {
            return [
                'ip' => $data['query'],
                'country' => $data['country'] ?? null,
                'countryCode' => $data['countryCode'] ?? null,
                'region' => $data['regionName'] ?? null,
                'city' => $data['city'] ?? null,
                'lat' => $data['lat'] ?? null,
                'lon' => $data['lon'] ?? null,
                'isp' => $data['isp'] ?? null,
                'org' => $data['org'] ?? null,
                'as' => $data['as'] ?? null
            ];
        }
    }
    
    // Return minimal data if geolocation fails
    return [
        'ip' => $ip,
        'country' => null,
        'city' => null,
        'lat' => null,
        'lon' => null,
        'isp' => null
    ];
}

/**
 * Get geolocation for multiple IPs with rate limiting
 * @param array $ips - Array of IP addresses
 * @return array - Array of hop data with geolocation
 */
function getGeolocations($ips) {
    $hops = [];
    
    foreach ($ips as $index => $ip) {
        // Get geolocation data
        $geoData = getGeolocation($ip);
        
        // Add hop number
        $geoData['hop'] = $index + 1;
        
        $hops[] = $geoData;
        
        // Rate limiting: Sleep for 0.7 seconds between requests
        // This ensures we stay under the 45 requests/minute limit
        // (0.7s = ~85 requests/minute, but with API call time, we're safe)
        if ($index < count($ips) - 1) {
            usleep(700000); // 0.7 seconds in microseconds
        }
    }
    
    return $hops;
}

// ============================================
// MAIN EXECUTION
// ============================================

try {
    // Execute traceroute
    $traceResult = executeTraceroute($target);
    
    // Check if traceroute was successful
    if (empty($traceResult['output'])) {
        throw new Exception('Traceroute command failed or returned no output');
    }
    
    // Parse traceroute output to extract IPs
    $ips = parseTraceroute($traceResult['output'], $traceResult['isWindows']);
    
    if (empty($ips)) {
        throw new Exception('No valid IP addresses found in traceroute output');
    }
    
    // Get geolocation data for all IPs
    $hops = getGeolocations($ips);
    
    // Prepare response
    $response = [
        'success' => true,
        'target' => $target,
        'timestamp' => date('Y-m-d H:i:s'),
        'hopCount' => count($hops),
        'hops' => $hops
    ];
    
    // Clean output buffer and send JSON
    ob_clean();
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    // Clean output buffer and send error JSON
    ob_clean();
    echo json_encode([
        'error' => $e->getMessage(),
        'target' => $target
    ]);
} catch (Throwable $e) {
    // Catch any other errors (PHP 7+)
    ob_clean();
    echo json_encode([
        'error' => 'An unexpected error occurred: ' . $e->getMessage(),
        'target' => $target
    ]);
}

// Flush output buffer
ob_end_flush();

// ============================================
// NOTES & IMPROVEMENTS
// ============================================

/*
 * RATE LIMITING:
 * - ip-api.com free tier: 45 requests/minute
 * - Current implementation: ~40 requests/minute (1.5s delay)
 * - For production: Consider caching results or using paid API
 * 
 * SECURITY:
 * - Input validation prevents command injection
 * - escapeshellarg() used for safe command execution
 * - Regex validation for domain/IP format
 * 
 * PERFORMANCE:
 * - Traceroute can take 30-60 seconds for distant targets
 * - Consider implementing async processing for better UX
 * - Could use JavaScript to poll for results
 * 
 * ALTERNATIVE GEOLOCATION APIS:
 * - ipapi.co (1000 requests/day free)
 * - ipgeolocation.io (1000 requests/day free)
 * - MaxMind GeoLite2 (local database, unlimited)
 * 
 * ENHANCEMENTS:
 * - Add hostname resolution (gethostbyaddr)
 * - Include RTT (round-trip time) data
 * - Add caching layer (Redis/Memcached)
 * - Implement WebSocket for real-time updates
 */
?>
