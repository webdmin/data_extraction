document.addEventListener('DOMContentLoaded', () => {
    const routesContainer = document.getElementById('routes-container');
    const routeDetailsModal = new bootstrap.Modal(document.getElementById('routeDetailsModal'));
    const routeDetailsContent = document.getElementById('routeDetailsContent');

    // Fetch and display stored routes
    async function fetchStoredRoutes() {
        try {
            const response = await fetch('http://127.0.0.1:5000/get_all_routes');
            if (!response.ok) {
                throw new Error('Failed to fetch routes');
            }
            const data = await response.json();
            displayRoutes(data.routes);
        } catch (error) {
            console.error('Error fetching routes:', error);
            routesContainer.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load routes. ${error.message}
                </div>
            `;
        }
    }

    // Display routes in the container
    function displayRoutes(routes) {
        if (routes.length === 0) {
            routesContainer.innerHTML = `
                <div class="alert alert-info">
                    No stored routes found.
                </div>
            `;
            return;
        }

        const routesHTML = routes.map(route => `
            <div class="card route-card" data-route-id="${route.id}">
                <div class="card-body">
                    <h5 class="card-title">Route from ${route.origin} to ${route.destination}</h5>
                    <p class="card-text text-muted">
                        Stored on: ${new Date(route.timestamp).toLocaleString()}
                    </p>
                    <button class="btn btn-sm btn-primary view-details-btn" 
                            data-route-id="${route.id}">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');

        routesContainer.innerHTML = routesHTML;

        // Add event listeners to view details buttons
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const routeId = e.target.dataset.routeId;
                await fetchRouteDetails(routeId);
            });
        });
    }

    // Fetch details for a specific route
    async function fetchRouteDetails(routeId) {
        try {
            const response = await fetch(`http://127.0.0.1:5000/get_route/${routeId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch route details');
            }
            const routeData = await response.json();
            displayRouteDetails(routeData);
        } catch (error) {
            console.error('Error fetching route details:', error);
            routeDetailsContent.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load route details. ${error.message}
                </div>
            `;
            routeDetailsModal.show();
        }
    }

    // Display route details in modal
    function displayRouteDetails(route) {
        // Extract useful information from stored route data
        const mapboxRouteData = route.mapbox_route_data[0];
        const overpassData = route.overpass_data;

        const detailsHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h5>Route Information</h5>
                    <p><strong>Origin:</strong> ${route.origin}</p>
                    <p><strong>Destination:</strong> ${route.destination}</p>
                    <p><strong>Stored On:</strong> ${new Date(route.timestamp).toLocaleString()}</p>
                </div>
                <div class="col-md-6">
                    <h5>Route Metrics</h5>
                    <p><strong>Distance:</strong> ${(mapboxRouteData.distance / 1000).toFixed(2)} km</p>
                    <p><strong>Duration:</strong> ${(mapboxRouteData.duration / 60).toFixed(2)} minutes</p>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <h5>Route Characteristics</h5>
                    <pre>${JSON.stringify(overpassData, null, 2)}</pre>
                </div>
            </div>
        `;

        routeDetailsContent.innerHTML = detailsHTML;
        routeDetailsModal.show();
    }

    // Initialize the page
    fetchStoredRoutes();
});