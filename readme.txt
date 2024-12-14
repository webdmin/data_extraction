1. Clone the repository
```bash
git clone link
cd route-visualization-app
```

2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

3. Install Python dependencies
```bash
pip install flask geopy overpy requests
```

4. Set up environment variables
Create a `.env` file in the project root:
```
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
```

5. Run the application
```bash
python app.py
```

## Project Structure
```
route-visualization-app/
│
├── app.py               # Flask backend
├── templates/
│   └── index.html       # HTML template
├── static/
│   └── js/
│       └── app.js       # Frontend JavaScript
├── requirements.txt     # Python dependencies
└── .env                 # Environment variables
```
