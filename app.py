import os
from flask import Flask, render_template, request, jsonify
import requests
from overpy import Overpass
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)

# Configure SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'route_data.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Enable CORS
CORS(app)

# Database Model for Route Data
class RouteData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    origin = db.Column(db.String(255), nullable=False)
    destination = db.Column(db.String(255), nullable=False)
    mapbox_route_data = db.Column(db.JSON, nullable=False)
    overpass_data = db.Column(db.JSON, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'origin': self.origin,
            'destination': self.destination,
            'mapbox_route_data': self.mapbox_route_data,
            'overpass_data': self.overpass_data,
            'timestamp': self.timestamp.isoformat()
        }

# Global flag to ensure database is only created once
_db_initialized = False

@app.before_request
def initialize_database():
    global _db_initialized
    if not _db_initialized:
        with app.app_context():
            db.create_all()
            _db_initialized = True

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/store_route_data', methods=['POST'])
def store_route_data():
    try:
        # Get data from the request
        data = request.json

        # Validate incoming data
        if not data or 'origin' not in data or 'destination' not in data or \
           'mapbox_route_data' not in data or 'overpass_data' not in data:
            return jsonify({'error': 'Invalid data format'}), 400

        # Create new RouteData entry
        new_route = RouteData(
            origin=data['origin'],
            destination=data['destination'],
            mapbox_route_data=data['mapbox_route_data'],
            overpass_data=data['overpass_data']
        )

        # Add to database
        db.session.add(new_route)
        db.session.commit()

        return jsonify({
            'message': 'Route data stored successfully',
            'route_id': new_route.id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/get_all_routes', methods=['GET'])
def get_all_routes():
    try:
        # Retrieve all stored routes
        routes = RouteData.query.order_by(RouteData.timestamp.desc()).all()
        return jsonify({
            'total_routes': len(routes),
            'routes': [route.to_dict() for route in routes]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_route/<int:route_id>', methods=['GET'])
def get_route(route_id):
    try:
        # Retrieve a specific route by ID
        route = RouteData.query.get_or_404(route_id)
        return jsonify(route.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Overpass API client
overpass_api = Overpass()

@app.route('/route_details', methods=['POST'])
def route_details():
    """
    Receive the route data from the frontend, query Overpass API,
    and return the features related to the route.
    """
    data = request.json
    routes = data.get('routes')

    if not routes:
        return jsonify({'error': 'No routes data found'}), 400

    # Send routes to Overpass for feature extraction
    route_details = []
    for route in routes:
        route_details.append(fetch_overpass_data(route['geometry']['coordinates']))
    
    return jsonify(route_details)

def fetch_overpass_data(coordinates):
    """
    Fetch detailed data from Overpass API using route coordinates
    """
    lat, lon = coordinates[0][1], coordinates[0][0]
    query = f"""
    [out:json];
    (
        way["highway"](around:1000,{lat},{lon});
    );
    out body;
    >;
    out skel qt;
    """
    try:
        result = overpass_api.query(query)

        highway_types = set()
        maxspeeds = []
        surfaces = set()
        total_lanes = 0

        for way in result.ways:
            highway = way.tags.get('highway', 'unknown')
            highway_types.add(highway)

            maxspeed = way.tags.get('maxspeed', '')
            if maxspeed.replace(' ', '').isdigit():
                maxspeeds.append(int(maxspeed))

            surface = way.tags.get('surface', 'unknown')
            surfaces.add(surface)

            lanes = way.tags.get('lanes', '')
            if lanes.isdigit():
                total_lanes += int(lanes)

        return {
            'highway_types': list(highway_types),
            'maxspeed': maxspeeds,
            'surfaces': list(surfaces),
            'total_lanes': total_lanes,
        }

    except Exception as e:
        return {'error': str(e)}
    
@app.route('/get_route_details', methods=['GET'])
def get_route_details():
    # Placeholder for server-side storage of route details
    return jsonify({})

# Update the existing imports and add this route
@app.route('/stored-routes')
def stored_routes_page():
    return render_template('stored-routes.html')

if __name__ == '__main__':
    app.run(debug=True)