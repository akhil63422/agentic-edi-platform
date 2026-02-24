# Starting MongoDB for Backend

The backend requires MongoDB to be running. Here are the options:

## Option 1: Using Docker (Recommended)

1. **Start Docker Desktop**:
   - Open Docker Desktop application on your Mac
   - Wait for it to fully start (whale icon in menu bar should be steady)

2. **Start MongoDB container**:
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

3. **Verify MongoDB is running**:
   ```bash
   docker ps | grep mongodb
   ```

## Option 2: Install MongoDB Locally

1. **Install MongoDB using Homebrew**:
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

2. **Start MongoDB service**:
   ```bash
   brew services start mongodb-community
   ```

3. **Verify MongoDB is running**:
   ```bash
   brew services list | grep mongodb
   ```

## After MongoDB is Running

Once MongoDB is running, restart the backend:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8001 --host 0.0.0.0
```

The backend will automatically connect to MongoDB at `localhost:27017`.
