// Mapbox Access Token
mapboxgl.accessToken = 'pk.eyJ1Ijoia2F2aWt1bWFyYW4iLCJhIjoiY2xqcmRlbDJ0MDA4eTNzbnV3Z2Z0YW9pZyJ9.p4QVPDyldRLRS1yCUIH0-Q';

let map; // Global map variable
let currentRouteData = null; // Store current route data globally

// Utility function for safe error handling
function handleError(error, customMessage = 'An error occurred') {
    console.error(error);
    showStatusMessage(`${customMessage}: ${error.message || error}`, 'error');
}

// Function to display status messages in the UI
function showStatusMessage(message, type = 'warning') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Remove previous classes and add new ones
    statusElement.classList.remove('alert-warning', 'alert-danger', 'alert-success');
    
    switch(type) {
        case 'error':
            statusElement.classList.add('alert-danger');
            break;
        case 'success':
            statusElement.classList.add('alert-success');
            break;
        default:
            statusElement.classList.add('alert-warning');
    }
}

// Function to initialize Mapbox and setup the map
function initMap() {
    try {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [-0.1276, 51.5074], // Default center (London)
            zoom: 10
        });

        // Add Mapbox controls
        map.addControl(new mapboxgl.NavigationControl());
        map.addControl(new mapboxgl.FullscreenControl());
    } catch (error) {
        handleError(error, 'Map initialization failed');
    }
}

// Function to clear existing map layers and markers
function clearMapLayers() {
    const layersToRemove = ['route', 'start-point', 'end-point'];
    layersToRemove.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
        if (map.getSource(layerId)) {
            map.removeSource(layerId);
        }
    });
}

// Function to plot route on the map
function plotRoute(routeCoordinates, origin, destination) {
    try {
        // Clear existing layers first
        clearMapLayers();

        // Add route line
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: routeCoordinates
                    }
                }
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#007cbf',
                'line-width': 7,
                'line-opacity': 0.75
            }
        });

        // Add start point marker
        map.addLayer({
            id: 'start-point',
            type: 'circle',
            source: {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: routeCoordinates[0]
                    }
                }
            },
            paint: {
                'circle-radius': 8,
                'circle-color': 'green',
                'circle-opacity': 0.7
            }
        });

        // Add end point marker
        map.addLayer({
            id: 'end-point',
            type: 'circle',
            source: {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: routeCoordinates[routeCoordinates.length - 1]
                    }
                }
            },
            paint: {
                'circle-radius': 8,
                'circle-color': 'red',
                'circle-opacity': 0.7
            }
        });

        // Fit the map to the route bounds
        const bounds = routeCoordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]));

        map.fitBounds(bounds, { 
            padding: 50,
            duration: 1000 // Smooth animation
        });

        // Optional: Add tooltips or popups for start and end points
        const startPopup = new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<h6>Start: ${origin}</h6>`);
        
        const endPopup = new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<h6>End: ${destination}</h6>`);

        // Add markers with popups
        new mapboxgl.Marker({ color: 'green' })
            .setLngLat(routeCoordinates[0])
            .setPopup(startPopup)
            .addTo(map);

        new mapboxgl.Marker({ color: 'red' })
            .setLngLat(routeCoordinates[routeCoordinates.length - 1])
            .setPopup(endPopup)
            .addTo(map);

    } catch (error) {
        handleError(error, 'Route plotting failed');
    }
}

// Function to display Overpass data in the interface
function displayOverpassData(overpassData) {
    try {
        const routeMetadataElement = document.getElementById('route-metadata');
        routeMetadataElement.innerHTML = ''; // Clear previous data

        // Check if overpassData is valid
        if (!overpassData || !overpassData.elements || overpassData.elements.length === 0) {
            routeMetadataElement.innerHTML = '<p class="text-muted">No detailed route information available.</p>';
            return;
        }

        // Aggregate route details
        const aggregatedDetails = {
            highwayTypes: new Set(),
            surfaces: new Set(),
            maxSpeeds: [],
            totalLanes: 0,
            roadNames: new Set()
        };

        overpassData.elements.forEach(element => {
            if (element.type === 'way' && element.tags) {
                const { tags } = element;
                
                // Collect details
                if (tags.highway) aggregatedDetails.highwayTypes.add(tags.highway);
                if (tags.surface) aggregatedDetails.surfaces.add(tags.surface);
                if (tags.name) aggregatedDetails.roadNames.add(tags.name);
                
                // Parse max speed
                if (tags.maxspeed && !isNaN(parseInt(tags.maxspeed))) {
                    aggregatedDetails.maxSpeeds.push(parseInt(tags.maxspeed));
                }

                // Parse lanes
                if (tags.lanes && !isNaN(parseInt(tags.lanes))) {
                    aggregatedDetails.totalLanes += parseInt(tags.lanes);
                }
            }
        });

        // Create detailed metadata HTML
        const metadataHTML = `
            <div class="route-metadata-content">
                <h5 class="mb-3">Route Characteristics</h5>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Highway Types:</strong> 
                            ${aggregatedDetails.highwayTypes.size > 0 
                                ? Array.from(aggregatedDetails.highwayTypes).join(', ') 
                                : 'Not Available'}
                        </p>
                        <p><strong>Road Surfaces:</strong> 
                            ${aggregatedDetails.surfaces.size > 0 
                                ? Array.from(aggregatedDetails.surfaces).join(', ') 
                                : 'Not Available'}
                        </p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Max Speeds:</strong> 
                            ${aggregatedDetails.maxSpeeds.length > 0 
                                ? aggregatedDetails.maxSpeeds.join(' km/h, ') + ' km/h' 
                                : 'Not Available'}
                        </p>
                        <p><strong>Total Lanes:</strong> 
                            ${aggregatedDetails.totalLanes || 'Not Available'}
                        </p>
                        <p><strong>Road Names:</strong> 
                            ${aggregatedDetails.roadNames.size > 0 
                                ? Array.from(aggregatedDetails.roadNames).join(', ') 
                                : 'Not Available'}
                        </p>
                    </div>
                </div>
            </div>
        `;

        routeMetadataElement.innerHTML = metadataHTML;

        // Store full JSON data for potential future use
        sessionStorage.setItem('overpassRouteData', JSON.stringify(overpassData));
    } catch (error) {
        handleError(error, 'Failed to process route details');
    }
}

// Geocoding function with error handling
async function geocodeLocation(location) {
    try {
        const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxgl.accessToken}`;
        const response = await fetch(geocodeUrl);
        
        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.features || data.features.length === 0) {
            throw new Error('No coordinates found for the given location');
        }
        
        return data.features[0].geometry.coordinates;
    } catch (error) {
        handleError(error, 'Geocoding error');
        throw error;
    }
}

// Route fetching function
async function getRouteFromMapbox(origin, destination) {
    try {
        const originCoords = await geocodeLocation(origin);
        const destinationCoords = await geocodeLocation(destination);

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?access_token=${mapboxgl.accessToken}&overview=full&geometries=geojson`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Route fetching failed: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            throw new Error('No routes found');
        }

        return data.routes;
    } catch (error) {
        handleError(error, 'Route fetching error');
        throw error;
    }
}

// Overpass data fetching function
async function getDataFromOverpass(coordinates) {
    try {
        // Take the first coordinate as a sample point for Overpass query
        const [lon, lat] = coordinates[0];

        const overpassQuery = `
            [out:json];
            (
                way["highway"](around:1000,${lat},${lon});
                node["amenity"](around:1000,${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `;

        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
        
        const response = await fetch(overpassUrl);
        
        if (!response.ok) {
            throw new Error(`Overpass data fetch failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        handleError(error, 'Overpass data fetching error');
        throw error;
    }
}

// Add this function to your existing app.js
async function storeRouteData(origin, destination, routeData, overpassData) {
    try {
        const response = await fetch('http://127.0.0.1:5000/store_route_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                origin: origin,
                destination: destination,
                mapbox_route_data: routeData,
                overpass_data: overpassData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to store route data');
        }

        const responseData = await response.json();
        console.log('Route data stored successfully:', responseData);
        
        return responseData;
    } catch (error) {
        console.error('Error storing route data:', error);
        showStatusMessage('Failed to store route data', 'error');
    }
}

// Main route search handler
async function handleRouteSearch(event) {
    event.preventDefault();

    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;

    if (!origin || !destination) {
        alert('Please enter both origin and destination.');
        return;
    }

    try {
        showStatusMessage('Searching for route...', 'warning');

        // Fetch route data from Mapbox
        const routeData = await getRouteFromMapbox(origin, destination);
        
        // Plot the route on the map
        const routeCoordinates = routeData[0].geometry.coordinates;
        plotRoute(routeCoordinates, origin, destination);

        showStatusMessage('Fetching route details...', 'warning');

        // Fetch Overpass data
        const overpassData = await getDataFromOverpass(routeCoordinates);
        
        // Display Overpass data
        displayOverpassData(overpassData);

        // Store route data
        await storeRouteData(origin, destination, routeData, overpassData);

        showStatusMessage('Route successfully retrieved and stored!', 'success');
    } catch (error) {
        showStatusMessage('Failed to retrieve route. Please try again.', 'error');
    }
}

// Optional: Add functions to retrieve stored routes
async function getAllStoredRoutes() {
    try {
        const response = await fetch('http://127.0.0.1:5000/get_all_routes');
        if (!response.ok) {
            throw new Error('Failed to fetch routes');
        }
        const routesData = await response.json();
        console.log('Stored Routes:', routesData);
        return routesData;
    } catch (error) {
        console.error('Error fetching stored routes:', error);
        showStatusMessage('Failed to retrieve stored routes', 'error');
    }
}

// Optional: Add a function to get a specific route by ID
async function getRouteById(routeId) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/get_route/${routeId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch route details');
        }
        const routeData = await response.json();
        console.log('Route Details:', routeData);
        return routeData;
    } catch (error) {
        console.error('Error fetching route details:', error);
        showStatusMessage('Failed to retrieve route details', 'error');
    }
}

// You might want to add a button or method to trigger these functions
// For example:
function setupRouteRetrievalButtons() {
    const getAllRoutesBtn = document.createElement('button');
    getAllRoutesBtn.textContent = 'Get All Stored Routes';
    getAllRoutesBtn.classList.add('btn', 'btn-secondary', 'mt-3');
    getAllRoutesBtn.onclick = getAllStoredRoutes;

    const controlsContainer = document.getElementById('controls-container');
    controlsContainer.appendChild(getAllRoutesBtn);
}

// Call this in your initializeApp function
function initializeApp() {
    try {
        initMap();

        // Set up the event listener for the route form
        const routeForm = document.getElementById('route-form');
        routeForm.addEventListener('submit', handleRouteSearch);

        // Add button to retrieve stored routes
        setupRouteRetrievalButtons();
    } catch (error) {
        handleError(error, 'App initialization failed');
    }
}
// Initialize the app when the page is loaded
document.addEventListener('DOMContentLoaded', initializeApp);