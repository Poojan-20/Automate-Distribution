from index import app

# Import routes to register them with the app
import routes

if __name__ == "__main__":
    app.run(debug=True, port=5328) 