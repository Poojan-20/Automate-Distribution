from index import app

# WSGI app for Vercel deployment
app = app

# Local development server
if __name__ == "__main__":
    app.run(debug=True, port=5328) 