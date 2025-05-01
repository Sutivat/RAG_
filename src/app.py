from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/process', methods=['POST'])
def process():
    data = request.get_json()
    video_url = data.get('video_url')
    query = data.get('query')
    print(f"Received video_url: {video_url}")
    print(f"Received query: {query}")
    
    # Example response
    return jsonify({"response": f"Got your query: {query}"})

if __name__ == '__main__':
    app.run(debug=True)
